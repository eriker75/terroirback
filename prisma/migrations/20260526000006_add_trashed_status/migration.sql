-- AlterEnum: agregar el estado TRASHED (papelera) a ContactMessageStatus
ALTER TYPE "ContactMessageStatus" ADD VALUE IF NOT EXISTS 'TRASHED';
