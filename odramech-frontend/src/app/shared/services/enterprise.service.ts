import { Injectable } from "@angular/core";
import { NestAPI } from "./nest-api.service";
import { Observable } from "rxjs";
import { Enterprise } from "@shared/models/Enterprise";
import { Establishment } from "@shared/models/Establishment";
import { EnterpriseWithEstablishments } from "@shared/models/EnterpriseWithEstablishment";

@Injectable({
  providedIn: 'root'
})
export class EnterpriseService {
    constructor(
        private readonly _nestApi: NestAPI
    ) {}

    createEnterpriseWithEstablishment(data: EnterpriseWithEstablishments): Observable<any> {
        return this._nestApi.post('enterprise/establishment', data)
    }
}