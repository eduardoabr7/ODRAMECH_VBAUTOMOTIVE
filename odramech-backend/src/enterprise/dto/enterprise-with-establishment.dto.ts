import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { EnterpriseDTO } from "./enterprise.dto";
import { EstablishmentListFullDTO } from "../../establishment/dto/establishment-list-full.dto";

export class EnterpriseWithEstablishmentDTO {
  @ValidateNested()
  @Type(() => EnterpriseDTO)
  enterprise: EnterpriseDTO;

  @ValidateNested()
  @Type(() => EstablishmentListFullDTO)
  establishment: EstablishmentListFullDTO;
}
