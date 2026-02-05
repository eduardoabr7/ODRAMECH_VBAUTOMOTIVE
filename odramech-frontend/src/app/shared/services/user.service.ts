import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { UserCreate } from "@shared/models/UserCreate";
import { NestAPI } from "./nest-api.service";

@Injectable({
  providedIn: 'root'
})
export class UserService {
    constructor(
        private readonly _nestApi: NestAPI
    ) {}

    create(data: UserCreate): Observable<any> {
        return this._nestApi.post('user/create', data)
    }

}