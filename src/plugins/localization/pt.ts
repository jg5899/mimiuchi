// i18n Portuguese translations
export default {
  settings: {
    connections: {
      title: 'Conexões',
      description: 'Enviar dados para outros aplicativos ao usar {icon}',
      http_server: {
        title: 'Servidor de Exibição HTTP',
        running: 'Servidor executando na porta {port}',
        stopped: 'Servidor parado',
      },
      info: {
        title: 'Informações de Conexão de Rede',
        description: 'Outros dispositivos podem conectar usando estes URLs',
        local_addresses: 'Endereços IP Locais',
        no_interfaces: 'Nenhuma interface de rede encontrada',
      },
      dialog: {
        title: {
          add: 'Adicionar conexão',
          edit: 'Editar conexão',
        },
        description: {
          websocket: 'Enviar atualizações de texto via websocket',
          webhook: 'Enviar atualizações de texto via solicitação POST webhook',
        },
        field: {
          title: 'Título',
          type: 'Tipo',
          address: 'Endereço',
          port: 'Porta',
          password: 'Senha',
          full_address: 'Endereço completo',
        },
        action: {
          cancel: 'Cancelar',
          confirm: 'Confirmar',
          delete: 'Excluir',
        },
      },
    },
  },
}
