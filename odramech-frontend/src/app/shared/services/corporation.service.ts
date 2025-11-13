import { Injectable } from "@angular/core";
import { NestAPI } from "./nest-api.service";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class CorporationService {
    constructor(
        private readonly _nestApi: NestAPI
    ) {}

    getUserCorporation(id): Observable<any> {
        return this._nestApi.get(`user/corporations/${id}`)
    }
}