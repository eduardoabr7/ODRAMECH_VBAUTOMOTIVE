export class EmailMaskService {
    
    mask(email: string): string {
        const [localPart, domain] = email.split("@");

        if (localPart.length <= 6) {
          // Caso o localPart seja muito curto, mostramos só a primeira e última letra
          return localPart[0] + "***" + localPart.slice(-1) + "@" + (domain? domain : '*****');
        }

        const firstThree = localPart.slice(0, 3);
        const lastThree = localPart.slice(-3);

        return `${firstThree}*****${lastThree}@${(domain? domain : '*****')}`;
    }
}