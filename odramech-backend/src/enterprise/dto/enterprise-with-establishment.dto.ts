import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { EnterpriseDTO } from "./enterprise.dto";
import { EstablishmentDTO } from "../../establishment/dto/establishment.dto";

export class EnterpriseWithEstablishmentDTO {
  @ValidateNested()
  @Type(() => EnterpriseDTO)
  enterprise: EnterpriseDTO;

  @ValidateNested()
  @Type(() => EstablishmentDTO)
  establishment: EstablishmentDTO;
}
