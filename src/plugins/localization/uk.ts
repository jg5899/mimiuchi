// i18n Ukrainian translations
export default {
  settings: {
    connections: {
      title: 'Підключення',
      description: 'Надсилайте дані в інші програми при використанні {icon}',
      http_server: {
        title: 'HTTP-сервер відображення',
        running: 'Сервер працює на порту {port}',
        stopped: 'Сервер зупинено',
      },
      info: {
        title: 'Інформація про мережеве підключення',
        description: 'Інші пристрої можуть підключитися за цими URL-адресами',
        local_addresses: 'Локальні IP-адреси',
        no_interfaces: 'Мережеві інтерфейси не знайдено',
      },
      dialog: {
        title: {
          add: 'Додати підключення',
          edit: 'Редагувати підключення',
        },
        description: {
          websocket: 'Надсилати оновлення тексту через websocket',
          webhook: 'Надсилати оновлення тексту через POST-запит webhook',
        },
        field: {
          title: 'Назва',
          type: 'Тип',
          address: 'Адреса',
          port: 'Порт',
          password: 'Пароль',
          full_address: 'Повна адреса',
        },
        action: {
          cancel: 'Скасувати',
          confirm: 'Підтвердити',
          delete: 'Видалити',
        },
      },
    },
  },
}
