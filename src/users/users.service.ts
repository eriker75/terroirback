import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../database/database.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private readonly userInclude = {
    addresses: true,
    orders: {
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    },
  } as const;

  private signToken(userId: string): string {
    const payload: JwtPayload = { id: userId };
    return this.jwtService.sign(payload);
  }

  async create(createUserDto: CreateUserDto) {
    const { password, ...rest } = createUserDto;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: { ...rest, password: hashedPassword },
        include: this.userInclude,
      });

      const accessToken = this.signToken(user.id);
      return { ...user, accessToken };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          `Ya existe un usuario registrado con ese correo electrónico`,
        );
      }
      throw error;
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

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
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Usuario inactivo, contacta con un administrador');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const { password: _, ...userWithoutPassword } = user;
    const accessToken = this.signToken(user.id);
    return { ...userWithoutPassword, accessToken };
  }

  async findAll({ limit, offset }: PaginationDto) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: this.userInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count(),
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

    return this.prisma.user.delete({
      where: { id },
    });
  }
}
