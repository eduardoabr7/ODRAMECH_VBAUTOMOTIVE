import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { env } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NestAPI {
  constructor(
    private readonly _httpClient: HttpClient
  ) {}

  readonly baseAPI = `http://${env.hostBackend}:${env.portBackend}`;

  url(endpoint: string): string {
    return `${this.baseAPI}/${endpoint}`;
  }

  get<T>(endpoint: string) {
    return this._httpClient.get<T>(this.url(endpoint), { withCredentials: true });
  }

  post<T>(endpoint: string, body?: any) {
    return this._httpClient.post<T>(this.url(endpoint), body ?? null, { withCredentials: true });
  }

  put<T>(endpoint: string, body: any) {
    return this._httpClient.put<T>(this.url(endpoint), body, { withCredentials: true });
  }

  delete<T>(endpoint: string) {
    return this._httpClient.delete<T>(this.url(endpoint), { withCredentials: true });
  }
}
