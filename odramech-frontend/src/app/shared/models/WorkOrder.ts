import { StatusOS } from "@shared/enums/status-os.enum"
import { AppointmentTypeEnum } from "@shared/enums/type-appointment.enum"
import { FinanceStats, MoneySummary, Payment, Review, ServiceItem } from "./Billing"

export interface PersonRef {
  id: number
  name: string
  email?: string | null
  principalPhone?: string
}

export interface VehicleRef {
  id: number
  plate: string
  name: string
  make: string
  color?: string | null
  km?: string | null
  modelYear?: number | null
  manufactureYear?: number | null
}

export interface ArchiveAppointment {
  id: number
  url: string
  mimeType: string
  originalName: string
  sizeBytes: number
  archiveType: 'IMAGEM' | 'DOCUMENTO' | 'VIDEO'
  createdAt: string
}

export interface Appointment {
  id: number
  dateTime: string
  contentHtml: string
  appointmentType: AppointmentTypeEnum
  userAppointment: PersonRef
  archives: ArchiveAppointment[]
}

export interface WorkOrder {
  id: number
  numberOs: number
  status: StatusOS
  dateTimeCreation: string
  dateTimeEnd?: string | null
  establishmentId: number
  client: PersonRef
  vehicle: VehicleRef
  userResponsible?: PersonRef | null
  userCreation: PersonRef
  userEnd?: PersonRef | null
  _count?: { appointments: number }
}

export interface WorkOrderDetail extends WorkOrder {
  appointments: Appointment[]
  items: ServiceItem[]
  payments: Payment[]
  summary: MoneySummary
  review: Review | null
  quote: { id: number; numberQuote: number } | null
}

export interface WorkOrderPage {
  items: WorkOrder[]
  total: number
  page: number
  pageSize: number
  countsByStatus: Record<StatusOS, number>
}

export interface WorkOrderStats {
  byStatus: Record<StatusOS, number>
  open: number
  finishedToday: number
  openedToday: number
  openedThisMonth: number
  clients: number
  recent: WorkOrder[]
  finance: FinanceStats
}

export interface WorkOrderListQuery {
  status?: StatusOS | null
  search?: string
  clientId?: number
  vehicleId?: number
  page?: number
  pageSize?: number
}
