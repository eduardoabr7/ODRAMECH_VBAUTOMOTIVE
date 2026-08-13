import { TypeAppointment } from "@prisma/client";
import { IsEnum, IsNumber, IsString } from "class-validator";

export class AppointmentCreateFrontDTO {

  @IsString()
  contentHtml: string;

  @IsEnum(TypeAppointment)
  appointmentType: TypeAppointment;

}