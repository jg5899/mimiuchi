// i18n German translations
export default {
  settings: {
    connections: {
      title: 'Verbindungen',
      description: 'Daten an andere Anwendungen senden bei Verwendung von {icon}',
      http_server: {
        title: 'HTTP-Anzeigeserver',
        running: 'Server läuft auf Port {port}',
        stopped: 'Server gestoppt',
      },
      info: {
        title: 'Netzwerkverbindungsinformationen',
        description: 'Andere Geräte können sich über diese URLs verbinden',
        local_addresses: 'Lokale IP-Adressen',
        no_interfaces: 'Keine Netzwerkschnittstellen gefunden',
      },
      dialog: {
        title: {
          add: 'Verbindung hinzufügen',
          edit: 'Verbindung bearbeiten',
        },
        description: {
          websocket: 'Textaktualisierungen über Websocket senden',
          webhook: 'Textaktualisierungen über POST-Anfrage webhook senden',
        },
        field: {
          title: 'Titel',
          type: 'Typ',
          address: 'Adresse',
          port: 'Port',
          password: 'Passwort',
          full_address: 'Vollständige Adresse',
        },
        action: {
          cancel: 'Abbrechen',
          confirm: 'Bestätigen',
          delete: 'Löschen',
        },
      },
    },
  },
}
