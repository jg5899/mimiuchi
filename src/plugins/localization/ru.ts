// i18n Russian translations
export default {
  settings: {
    connections: {
      title: 'Подключения',
      description: 'Отправляйте данные в другие приложения при использовании {icon}',
      http_server: {
        title: 'HTTP-сервер отображения',
        running: 'Сервер работает на порту {port}',
        stopped: 'Сервер остановлен',
      },
      info: {
        title: 'Информация о сетевом подключении',
        description: 'Другие устройства могут подключиться по этим URL-адресам',
        local_addresses: 'Локальные IP-адреса',
        no_interfaces: 'Сетевые интерфейсы не найдены',
      },
      dialog: {
        title: {
          add: 'Добавить подключение',
          edit: 'Редактировать подключение',
        },
        description: {
          websocket: 'Отправлять обновления текста через websocket',
          webhook: 'Отправлять обновления текста через POST-запрос webhook',
        },
        field: {
          title: 'Название',
          type: 'Тип',
          address: 'Адрес',
          port: 'Порт',
          password: 'Пароль',
          full_address: 'Полный адрес',
        },
        action: {
          cancel: 'Отмена',
          confirm: 'Подтвердить',
          delete: 'Удалить',
        },
      },
    },
  },
}
