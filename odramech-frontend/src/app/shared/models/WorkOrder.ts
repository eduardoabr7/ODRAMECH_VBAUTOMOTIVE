import { StatusOS } from "@shared/enums/status-os.enum"
import { AppointmentTypeEnum } from "@shared/enums/type-appointment.enum"


interface Appointment {
    contentHtml: string,
    appointmentType: AppointmentTypeEnum    
}

export interface WorkOrder {
  status: StatusOS
  establishmentId: number
  userCreationId: number
  userResponsibleId?: number
  clientId: number
  vehicleId: number
  appointment?: Appointment
}