import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface SettingCard {
  name: string;
  description: string;
  category: string;
  iconClass: string;
  iconColor: string;
  iconBg: string;
  enabled?: boolean;
  enableMode: boolean;   // true = mostra toggle on/off
  connectMode: boolean;  // true = mostra botão "Conectar"
}

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {

  searchQuery = '';
  activeFilter = 'all';

  filters = [
    { key: 'all',          label: 'Todos'       },
    { key: 'oficina',      label: 'Oficina'      },
    { key: 'usuarios',     label: 'Usuários'     },
    { key: 'financeiro',   label: 'Financeiro'   },
    { key: 'notificacoes', label: 'Notificações' },
    { key: 'integracao',   label: 'Integrações'  },
  ];

  cards: SettingCard[] = [
    {
      name: 'Minha Oficina',
      description: 'Defina permissões, configure informações e gerencie sua oficina.',
      category: 'oficina',
      iconClass: 'fas fa-store',
      iconColor: '#4f6ef7',
      iconBg: '#eef1fe',
      enableMode: false,
      connectMode: false,
    },
    {
      name: 'Usuários e Permissões',
      description: 'Gerencie colaboradores, funções e níveis de acesso ao sistema.',
      category: 'usuarios',
      iconClass: 'fas fa-users',
      iconColor: '#e04f3a',
      iconBg: '#fef3f2',
      enableMode: false,
      connectMode: false,
    },
    {
      name: 'Financeiro',
      description: 'Configure formas de pagamento, taxas e relatórios financeiros.',
      category: 'financeiro',
      iconClass: 'fas fa-dollar-sign',
      iconColor: '#22c55e',
      iconBg: '#f0fdf4',
      enableMode: false,
      connectMode: false,
    },
    {
      name: 'Notificações',
      description: 'Configure alertas por e-mail, SMS e push para clientes e equipe.',
      category: 'notificacoes',
      iconClass: 'fas fa-bell',
      iconColor: '#f97316',
      iconBg: '#fff7ed',
      enabled: false,
      enableMode: true,
      connectMode: false,
    },
    {
      name: 'WhatsApp',
      description: 'Envie mensagens automáticas de confirmação e lembrete via WhatsApp.',
      category: 'integracao',
      iconClass: 'fab fa-whatsapp',
      iconColor: '#22c55e',
      iconBg: '#f0fdf4',
      enableMode: true,
      connectMode: true,
    },
    {
      name: 'API Externa',
      description: 'Conecte sistemas externos via API REST para sincronização de dados.',
      category: 'integracao',
      iconClass: 'fas fa-plug',
      iconColor: '#a855f7',
      iconBg: '#faf5ff',
      enabled: true,
      enableMode: true,
      connectMode: false,
    },
    {
      name: 'Agendamentos',
      description: 'Gerencie horários, bloqueios e regras de agendamento online.',
      category: 'oficina',
      iconClass: 'fas fa-calendar-alt',
      iconColor: '#3b82f6',
      iconBg: '#eff6ff',
      enableMode: false,
      connectMode: false,
    },
    {
      name: 'Notas Fiscais',
      description: 'Emita NF-e e NFS-e diretamente pelo sistema de forma automatizada.',
      category: 'financeiro',
      iconClass: 'fas fa-file-invoice',
      iconColor: '#ec4899',
      iconBg: '#fdf2f8',
      enabled: false,
      enableMode: true,
      connectMode: false,
    },
    {
      name: 'Segurança',
      description: 'Configure autenticação em dois fatores e políticas de senha.',
      category: 'usuarios',
      iconClass: 'fas fa-shield-alt',
      iconColor: '#f97316',
      iconBg: '#fff7ed',
      enableMode: false,
      connectMode: false,
    },
  ];

  get filteredCards(): SettingCard[] {
    const q = this.searchQuery.toLowerCase();
    return this.cards.filter(card => {
      const matchesFilter = this.activeFilter === 'all' || card.category === this.activeFilter;
      const matchesSearch = !q || card.name.toLowerCase().includes(q) || card.description.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }

  setFilter(key: string): void {
    this.activeFilter = key;
  }
}