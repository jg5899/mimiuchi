// i18n japanese translations
export default {
  welcome: {
    intro: {
      title: '{name}へようこそ！',
      description: '{name}は、話されたや入力された言葉をカスタマイズ可能なテキストウィンドウに表示することができるで、OBSなどのアプリで簡単に結果を表示できるようにすることができます。また、他のアプリ（VRChatなど）へのテキストやコマンドの中継もサポートしています。',
      button: '次へ',
    },
    controls: {
      title: 'コントロール',
      broadcast: 'ブロードキャストをトグルする（デスクトップアプリが必要）',
      mic: 'Speech-to-Textをトグルする（ブラウザーとマイクの許可が必要）',
      settings: '設定ページを開く',
      button: '閉じる',
    },
  },
  general: {
    type_message: 'メッセージを送信',
    beta: 'ベータ',
    update: 'アップデート',
    subject_to_change: '変更の可能性があります',
  },
  snackbar: {
    version_mismatch: 'デスクトップ版とウェブアプリ版は別物です。壊れるかもしれないので、アップデートを検討してください。',
    no_speech: 'このブラウザはWeb Speech APIをサポートしていません（Speech-to-text）',
    speech_recognition_error_event: {
      aborted: 'Error: デバイスが別のブラウザタブで使用中です',
      not_allowed: 'マイクのアクセスに失敗しました。許可する必要があります。',
    },
  },
  settings: {
    title: 'ユーザー設定',
    general: {
      title: '全般設定',
      description: 'アプリ全般の設定',
      language: 'UIの言語を選択',
      transcript: 'セッショントランスクリプトをダウンロードする',
      realtime_text: 'テキストボックスのテキストは継続的に送信する',
      auto_open_web_app: 'アプリ起動時にウェブアプリを開く',
      reset: {
        button: 'アプリの設定をリセットする',
        dialog: {
          title: '設定をリセットする',
          description: 'アプリの設定がリセットされます。本当にリセットしてもいいですか。',
          button: 'リセット',
        },
        snackbar: {
          title: '設定がリセットされた',
          button: '閉じる',
        },
      },
    },
    stt: {
      title: 'Speech-to-Text',
      description: 'Speech-to-textの設定',
      type: 'STTサービスを選択',
      sensitivity: '感度ゲート',
      sensitivity_start: 'マイクテスト',
      sensitivity_stop: 'テストを中...',
      device: 'デバイス： ',
      pinned_languages: 'ピン留めされた言語',
      language: 'Speech-to-textの言語を選択',
      unsupported: {
        text: 'Web Speech APIのSpeech-to-Textは{link}で利用できます。{kaomoji}',
        link: 'ウェブサイト版',
        kaomoji: '(^・ω・^)',
      },
    },
    tts: {
      title: 'Text-to-Speech',
      description: 'Text-to-speechの設定',
      type: 'TTSサービスを選択',
      enabled: 'テキストを音声に変換',
      rate: 'スピード',
      pitch: 'ピッチ',
      language: 'Text-to-speechの音声を選択',
      unsupported: {
        text: 'Text-to-Speechは{link}で利用できます。{kaomoji}',
        link: 'ウェブサイト版',
        kaomoji: '(^・ω・^)',
      },
    },
    appearance: {
      title: 'テーマ',
      description: 'アプリのテーマを変更',
      theme: 'テーマ',
      footer: 'フッター設定',
      footer_size: {
        hint: 'フッターサイズ',
        options: [
          {
            title: '小さい',
            value: 0,
          },
          {
            title: '大きい',
            value: 1,
          },
        ],
      },
      text: {
        title: '文字設定',
        font_family: 'フォント',
        font_type: 'タイプ',
        font_size: '文字の大きさ',
        outline: {
          enabled: 'テキスト輪郭',
          size: 'テキスト輪郭の大きさ',
          color: 'テキスト輪郭色',
        },
        fade: 'フェード',
        fade_after: '〇〇秒後にフェード',
        fade_for: '〇〇秒間のフェード',
        new_line_delay: {
          hint: 'テキストが送信されないと、改行を挿入す',
          options: [
            {
              title: 'すぐに',
              value: 0,
            },
            {
              title: '2秒後',
              value: 2,
            },
            {
              title: '4秒後',
              value: 4,
            },
            {
              title: '6秒後',
              value: 6,
            },
            {
              title: '8秒後',
              value: 8,
            },
            {
              title: '10秒後',
              value: 10,
            },
            {
              title: '改行なし',
              value: -1,
            },
          ],
        },
        seconds: '秒',
        color: '文字色',
        interim_color: '中間文字色',
      },
      ui: {
        title: 'UI設定',
        color: 'ウインドウ色',
      },
    },
    word_replace: {
      title: 'テキストリプレース',
      description: 'ここで置き換えるテキストを追加します',
      enabled: 'テキストリプレース',
      match_whole_word: '単語単位',
      match_case: '大文字/小文字を区別',
      info: '新しい置き換えを追加する場合は{icon}バタンを使用してください。',
      replacing: 'リプレース',
      replacement: 'リプレースメント',
    },
    translation: {
      title: '翻訳',
      description: '他の言語に翻訳する設定',
      warning: '翻訳は進行中です。完璧なものとして信用しないでください！',
      enabled: '翻訳を有効にする',
      type: '翻訳サービスの選択する',
      source: '翻訳元言語',
      target: '目標言語',
      show_original: '翻訳する前に元のテキストを表示する',
      ml_notice: '{0}はCPUを使用して、デバイス上で翻訳を生成する機械学習を搭載したライブラリです。ローエンドのコンピュータでは、うまく動作しない場合があります。',
      speech_lang: 'Speech-to-text言語は',
      unsupported: {
        text: '翻訳サービスは{link}で利用できます。{kaomoji}',
        link: 'デスクトップアプリ版',
        kaomoji: '(^・ω・^)',
      },
    },
    connections: {
      title: '接続',
      description: '{icon}使用時に他のアプリにデータを送信',
      action: {
        add: '接続を追加するには{icon}ボタンを使用してください。',
      },
      http_server: {
        title: 'HTTP表示サーバー',
        running: 'ポート{port}で実行中',
        stopped: 'サーバー停止中',
      },
      info: {
        title: 'ネットワーク接続情報',
        description: '他のデバイスはこれらのURLを使用して接続できます',
        local_addresses: 'ローカルIPアドレス',
        no_interfaces: 'ネットワークインターフェースが見つかりません',
      },
      dialog: {
        title: {
          add: '接続の追加',
          edit: '接続の編集',
        },
        description: {
          websocket: 'ウェブソケットでテキスト更新を即座に送信できます',
          webhook: 'テキスト更新をWebhookのPOSTリクエストで送信できます',
        },
        field: {
          title: '接続名',
          type: '接続型',
          address: 'アドレス',
          port: 'ポート',
          password: 'パスワード',
          password_placeholder: '認証が無効な場合は入力不要です',
          full_address: 'フルアドレス',
        },
        action: {
          cancel: 'キャンセル',
          confirm: 'OK',
          delete: '削除',
        },
      },
    },
  },
}
