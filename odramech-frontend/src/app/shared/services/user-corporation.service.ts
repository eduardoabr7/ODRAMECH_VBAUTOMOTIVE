import { Injectable } from "@angular/core";
import { NestAPI } from "./nest-api.service";
import { Observable } from "rxjs";
import { UserCorporation } from "@shared/models/UserCorporation";
import { EnterpriseWithEstablishments } from "@shared/models/EnterpriseWithEstablishment";
import { Enterprise } from "@shared/models/Enterprise";

@Injectable({
  providedIn: 'root'
})
export class UserCorporationService {
    constructor(
        private readonly _nestApi: NestAPI
    ) {}

    getUserCorporation(): Observable<Enterprise[]> {
        return this._nestApi.get('usercorp')
    }

    createUserCorporation(data: UserCorporation): Observable<any> {
        return this._nestApi.post(`usercorp`, data)
    }
}