import { Controller, Get } from "@nestjs/common";
import { EnterpriseService } from "../services/enterprise.service";

@Controller('enterprise')
export class EnterpriseController {

    constructor(
        private readonly _enterpriseService: EnterpriseService
    ){}

    @Get()
    getAllEnterprises(){
        return this._enterpriseService.getAll();
    }

}