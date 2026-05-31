import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/database.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UserQueryDto } from './dto/user-query.dto';

/** Duración del refresh token: 30 días en ms */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private readonly userInclude = {
    addresses: true,
  } as const;

  // ── tokens ────────────────────────────────────────────────────────────────────

  private signAccessToken(userId: string): string {
    const payload: JwtPayload = { id: userId };
    return this.jwtService.sign(payload);
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.refreshToken.create({ data: { token, userId, expiresAt } });
    return token;
  }

  private async issueTokenPair(userId: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(userId),
      this.createRefreshToken(userId),
    ]);
    return { accessToken, refreshToken };
  }

  // ── usuarios ──────────────────────────────────────────────────────────────────

  private async createUser(data: Prisma.UserCreateInput) {
    const { password, ...rest } = data;
    // password es opcional en el modelo (cuentas sólo-social), pero el alta clásica la exige
    if (!password) {
      throw new BadRequestException('Se requiere una contraseña');
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: { ...rest, password: hashedPassword },
        include: this.userInclude,
      });

      const { accessToken, refreshToken } = await this.issueTokenPair(user.id);
      return { ...user, accessToken, refreshToken };
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un usuario registrado con ese correo electrónico',
        );
      }
      throw error;
    }
  }

  async register(registerUserDto: RegisterUserDto) {
    return this.createUser({ ...registerUserDto, role: 'customer', status: 'active' });
  }

  async registerAdmin(registerUserDto: RegisterUserDto) {
    return this.createUser({ ...registerUserDto, role: 'admin', status: 'active' });
  }

  async create(createUserDto: CreateUserDto) {
    return this.createUser(createUserDto);
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;
    console.log('[login] intento con email:', email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        password: true,
      },
    });

    if (!user) {
      console.log('[login] usuario no encontrado para:', email);
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    console.log('[login] usuario encontrado → status:', user.status, '| role:', user.role);

    if (user.status !== 'active') {
      console.log('[login] usuario inactivo');
      throw new UnauthorizedException('Usuario inactivo, contacta con un administrador');
    }

    if (!user.password) {
      // Cuenta creada vía login social (Google/Apple): no tiene contraseña local
      throw new UnauthorizedException('Esta cuenta inicia sesión con Google/Apple');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('[login] password válido:', isPasswordValid);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const { password: _, ...userWithoutPassword } = user;
    const { accessToken, refreshToken } = await this.issueTokenPair(user.id);
    console.log('[login] OK → id:', user.id);
    return { ...userWithoutPassword, accessToken, refreshToken };
  }

  // ── refresh & logout ──────────────────────────────────────────────────────────

  async refresh(rawToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: rawToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (stored.user.status !== 'active') {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Rotación: revocar el token usado y emitir uno nuevo
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    const { accessToken, refreshToken } = await this.issueTokenPair(stored.user.id);
    return { ...stored.user, accessToken, refreshToken };
  }

  async logout(rawToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: rawToken, isRevoked: false },
      data: { isRevoked: true },
    });
    return { message: 'Sesión cerrada correctamente' };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  async findAll({ limit, offset, search, role, status }: UserQueryDto) {
    const where: Prisma.UserWhereInput = {};

    if (role) where.role = role;
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: this.userInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: this.userInclude,
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    const { password, ...rest } = updateUserDto;
    const data = password
      ? { ...rest, password: await bcrypt.hash(password, 10) }
      : rest;

    return this.prisma.user.update({
      where: { id },
      data,
      include: this.userInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.delete({ where: { id } });
  }

  async getCustomerStats() {
    const [total, active, inactive] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: 'customer' } }),
      this.prisma.user.count({ where: { role: 'customer', status: 'active' } }),
      this.prisma.user.count({ where: { role: 'customer', status: 'inactive' } }),
    ]);
    return { total, active, inactive };
  }
}
