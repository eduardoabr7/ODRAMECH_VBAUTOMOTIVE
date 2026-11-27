import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    providers: [JwtAuthGuard],
    controllers:[],
    exports: [JwtAuthGuard]
})

export class SharedModule{}
