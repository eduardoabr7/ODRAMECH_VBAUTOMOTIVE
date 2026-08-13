import { StatusOS } from "@shared/enums/status-os.enum"
import { AppointmentTypeEnum } from "@shared/enums/type-appointment.enum"


interface Appointment {
    contentHtml: string,
    appointmentType: AppointmentTypeEnum    
}

export interface WorkOrderCreate {
  status: StatusOS
  userResponsibleId?: number
  clientId: number
  vehicleId: number
  appointment?: Appointment
}