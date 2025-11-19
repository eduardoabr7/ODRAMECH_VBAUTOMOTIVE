import { Injectable } from "@angular/core";
import { NestAPI } from "./nest-api.service";
import { Observable } from "rxjs";
import { UserCorporation } from "@shared/models/UserCorporation";

@Injectable({
  providedIn: 'root'
})
export class UserCorporationService {
    constructor(
        private readonly _nestApi: NestAPI
    ) {}

    getUserCorporation(id): Observable<any> {
        return this._nestApi.get(`user/corporations/${id}`)
    }

    createUserCorporation(data: UserCorporation): Observable<any> {
        return this._nestApi.post(`usercorp`, data)
    }
}