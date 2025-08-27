// src/app/shared/services/nest-api.service.ts

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { env } from '../../../environments/environment'; // Importe o arquivo de ambiente

@Injectable({
  providedIn: 'root'
})
export class NestAPI {
  constructor(
    private readonly _httpClient: HttpClient
  ) {}

  private baseAPI = `http://${env.hostBackend}:${env.portBackend}`;

  get<T>(endpoint: string) {
    return this._httpClient.get<T>(`${this.baseAPI}/${endpoint}`, { withCredentials: true });
  }

  post<T>(endpoint: string, body: any) {
    return this._httpClient.post<T>(`${this.baseAPI}/${endpoint}`, body, { withCredentials: true });
  }

  put<T>(endpoint: string, body: any) {
    return this._httpClient.put<T>(`${this.baseAPI}/${endpoint}`, body, { withCredentials: true });
  }

  delete<T>(endpoint: string) {
    return this._httpClient.delete<T>(`${this.baseAPI}/${endpoint}`, { withCredentials: true });
  }
}