// i18n Italian translations
export default {
  settings: {
    connections: {
      title: 'Connessioni',
      description: 'Invia dati ad altre applicazioni quando usi {icon}',
      http_server: {
        title: 'Server di Visualizzazione HTTP',
        running: 'Server in esecuzione sulla porta {port}',
        stopped: 'Server fermato',
      },
      info: {
        title: 'Informazioni Connessione di Rete',
        description: 'Altri dispositivi possono connettersi usando questi URL',
        local_addresses: 'Indirizzi IP Locali',
        no_interfaces: 'Nessuna interfaccia di rete trovata',
      },
      dialog: {
        title: {
          add: 'Aggiungi connessione',
          edit: 'Modifica connessione',
        },
        description: {
          websocket: 'Invia aggiornamenti di testo tramite websocket',
          webhook: 'Invia aggiornamenti di testo tramite richiesta POST webhook',
        },
        field: {
          title: 'Titolo',
          type: 'Tipo',
          address: 'Indirizzo',
          port: 'Porta',
          password: 'Password',
          full_address: 'Indirizzo completo',
        },
        action: {
          cancel: 'Annulla',
          confirm: 'Conferma',
          delete: 'Elimina',
        },
      },
    },
  },
}
