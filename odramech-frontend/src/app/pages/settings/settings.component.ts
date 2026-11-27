import { CommonModule } from '@angular/common';
import { Component, Type } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ModalSettingsEnterpriseComponent } from '@shared/components/modals/enterprise-modals/modal-settings-enterprise/modal-settings-enterprise.component';
import { ModalManageWorkersComponent } from '@shared/components/modals/user-modals/modal-manage-workers/modal-manage-workers.component';

interface SettingCard {
  name: string;
  description: string;
  category: string;
  icon: string;
  openModal?: Type<any>;
  /** navega para uma página em vez de abrir modal */
  route?: string;
  /** false = funcionalidade ainda não implementada (precisa de backend/schema) */
  available: boolean;
}

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {

  constructor(private readonly _bsModalService: BsModalService, private readonly _router: Router) {}

  searchQuery = '';
  activeFilter = 'all';

  filters = [
    { key: 'all',          label: 'Tudo' },
    { key: 'oficina',      label: 'Oficina' },
    { key: 'usuarios',     label: 'Equipe' },
    { key: 'financeiro',   label: 'Financeiro' },
    { key: 'integracao',   label: 'Integrações' },
  ];

  cards: SettingCard[] = [
    { name: 'Assinatura', description: 'Plano (Basic, Intermediário, Pro ou Ultra), faturas e forma de pagamento.', category: 'financeiro', icon: 'fa-solid fa-crown', route: '/settings/subscription', available: true },
    { name: 'Documento de orçamento', description: 'Modelo de impressão/PDF, validade padrão e status ao imprimir.', category: 'oficina', icon: 'fa-solid fa-file-invoice', route: '/settings/quote-document', available: true },
    { name: 'E-mail de envio', description: 'SMTP próprio da empresa (ex.: noreply@suaoficina.com.br) para enviar orçamentos aos clientes.', category: 'integracao', icon: 'fa-regular fa-envelope', route: '/settings/mail', available: true },
    { name: 'Tema e marca', description: 'Logo, nome e cor da oficina no sistema e na tela de login.', category: 'oficina', icon: 'fa-solid fa-palette', route: '/settings/theme', available: true },
    { name: 'Minha oficina', description: 'Estabelecimentos da empresa, dados de contato e endereço.', category: 'oficina', icon: 'fa-solid fa-warehouse', openModal: ModalSettingsEnterpriseComponent, available: true },
    { name: 'Equipe e permissões', description: 'Cadastre mecânicos e administradores e defina quem acessa o quê.', category: 'usuarios', icon: 'fa-solid fa-user-shield', openModal: ModalManageWorkersComponent, available: true },
    { name: 'Agendamentos', description: 'Horários de atendimento, bloqueios e agendamento online.', category: 'oficina', icon: 'fa-regular fa-calendar', available: false },
    { name: 'Financeiro', description: 'Formas de pagamento, taxas e relatórios de faturamento.', category: 'financeiro', icon: 'fa-solid fa-wallet', available: false },
    { name: 'Notas fiscais', description: 'Emissão de NF-e e NFS-e direto da OS.', category: 'financeiro', icon: 'fa-solid fa-file-invoice', available: false },
    { name: 'Notificações', description: 'Avisos por e-mail e SMS para cliente e equipe a cada mudança de status.', category: 'integracao', icon: 'fa-regular fa-bell', available: false },
    { name: 'WhatsApp', description: 'Confirmações e lembretes automáticos pelo WhatsApp.', category: 'integracao', icon: 'fa-brands fa-whatsapp', available: false },
    { name: 'API externa', description: 'Integre sistemas de terceiros via API REST.', category: 'integracao', icon: 'fa-solid fa-code', available: false },
    { name: 'Segurança', description: 'Autenticação em duas etapas e política de senhas.', category: 'usuarios', icon: 'fa-solid fa-fingerprint', available: false },
  ];

  get filteredCards(): SettingCard[] {
    const q = this.searchQuery.toLowerCase().trim();
    return this.cards.filter(card => {
      const matchesFilter = this.activeFilter === 'all' || card.category === this.activeFilter;
      const matchesSearch = !q || card.name.toLowerCase().includes(q) || card.description.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }

  open(card: SettingCard): void {
    if (!card.available) return;
    if (card.route) {
      this._router.navigateByUrl(card.route);
      return;
    }
    if (!card.openModal) return;
    this._bsModalService.show(card.openModal, {
      initialState: { title: card.name },
      class: 'modal-lg'
    });
  }
}
