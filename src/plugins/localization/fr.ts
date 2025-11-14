// i18n French translations
export default {
  settings: {
    connections: {
      title: 'Connexions',
      description: 'Envoyer des données vers d\'autres applications lors de l\'utilisation de {icon}',
      http_server: {
        title: 'Serveur d\'affichage HTTP',
        running: 'Serveur en cours d\'exécution sur le port {port}',
        stopped: 'Serveur arrêté',
      },
      info: {
        title: 'Informations de connexion réseau',
        description: 'D\'autres appareils peuvent se connecter en utilisant ces URL',
        local_addresses: 'Adresses IP locales',
        no_interfaces: 'Aucune interface réseau trouvée',
      },
      dialog: {
        title: {
          add: 'Ajouter une connexion',
          edit: 'Modifier la connexion',
        },
        description: {
          websocket: 'Envoyer des mises à jour de texte via websocket',
          webhook: 'Envoyer des mises à jour de texte via requête POST webhook',
        },
        field: {
          title: 'Titre',
          type: 'Type',
          address: 'Adresse',
          port: 'Port',
          password: 'Mot de passe',
          full_address: 'Adresse complète',
        },
        action: {
          cancel: 'Annuler',
          confirm: 'Confirmer',
          delete: 'Supprimer',
        },
      },
    },
  },
}
