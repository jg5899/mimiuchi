// i18n Romanian translations
export default {
  settings: {
    connections: {
      title: 'Conexiuni',
      description: 'Trimite date către alte aplicații când folosești {icon}',
      http_server: {
        title: 'Server de Afișare HTTP',
        running: 'Server rulează pe portul {port}',
        stopped: 'Server oprit',
      },
      info: {
        title: 'Informații Conexiune Rețea',
        description: 'Alte dispozitive se pot conecta folosind aceste URL-uri',
        local_addresses: 'Adrese IP Locale',
        no_interfaces: 'Nu s-au găsit interfețe de rețea',
      },
      dialog: {
        title: {
          add: 'Adaugă conexiune',
          edit: 'Editează conexiune',
        },
        description: {
          websocket: 'Trimite actualizări text prin websocket',
          webhook: 'Trimite actualizări text prin cerere POST webhook',
        },
        field: {
          title: 'Titlu',
          type: 'Tip',
          address: 'Adresă',
          port: 'Port',
          password: 'Parolă',
          full_address: 'Adresă completă',
        },
        action: {
          cancel: 'Anulează',
          confirm: 'Confirmă',
          delete: 'Șterge',
        },
      },
    },
  },
}
