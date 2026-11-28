export interface UserLogged {
    id: number
    name: string
    email: string
    principalPhone: string
    context: string
    /** senha provisória: troca obrigatória antes de usar o sistema */
    mustChangePassword?: boolean
}