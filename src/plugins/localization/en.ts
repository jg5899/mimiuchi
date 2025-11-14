// i18n english translations
export default {
  welcome: {
    intro: {
      title: 'Welcome to {name}!',
      description: '{name} is a captioning tool that can display spoken or typed text onto a customizable window so that you can effortlessly display the results in applications like OBS. It also supports relaying text and commands to other applications (like VRChat).',
      button: 'next',
    },
    controls: {
      title: 'Controls',
      broadcast: 'Toggle broadcasting (requires desktop app)',
      mic: 'Toggle speech-to-text (requires browser permission)',
      settings: 'Open settings panel',
      button: 'close',
    },
  },
  general: {
    type_message: 'Type a message',
    beta: 'BETA',
    update: 'Update',
    subject_to_change: 'Subject to change',
  },
  snackbar: {
    version_mismatch: 'The desktop app has a different version than the web version. Consider updating, as things might break.',
    no_speech: 'Your browser does not support Web Speech API (Speech-to-text).',
    speech_recognition_error_event: {
      aborted: 'Audio device in use.',
      audio_capture: 'Audio capture failed.',
      network: 'Network communication required for completing the recognition failed.',
      not_allowed: 'You must give permission to use the microphone.',
      service_not_allowed: 'The speech recognition service cannot be started due to settings or policies.',
      bad_grammar: 'There was a problem with the SpeechGrammarList.',
      language_not_supported: 'The speech recognition language is not supported by the browser.',
      unknown: 'An unknown speech recognition error occurred.',
    },
    connections: {
      websocket: {
        opened: 'WebSocket opened.',
        closed: 'WebSocket closed.',
      },
    },
  },
  settings: {
    title: 'Settings',
    general: {
      title: 'General',
      description: 'General application settings',
      language: 'Select a UI language',
      transcript: 'Download session transcript',
      realtime_text: 'Instant textbox updates',
      auto_open_web_app: 'Open web app on launch',
      reset: {
        button: 'Reset all settings',
        dialog: {
          title: 'Reset Settings',
          description: 'You are about to reset settings for the entire application.',
          button: 'Reset',
        },
        snackbar: {
          title: 'Settings reset',
          button: 'Close',
        },
      },
    },
    stt: {
      title: 'Speech-to-Text',
      description: 'Speech-to-text settings',
      type: 'Select a STT service',
      sensitivity: 'Sensitivity gate',
      sensitivity_start: 'Check',
      sensitivity_stop: 'Stop',
      device: 'Listening: ',
      pinned_languages: 'Pinned languages',
      language: 'Select a speech detection language',
      unsupported: {
        text: 'Web Speech API Speech-to-Text is only available on the {link}. {kaomoji}',
        link: 'website version',
        kaomoji: '(^・ω・^)',
      },
    },
    tts: {
      title: 'Text-to-Speech',
      description: 'Text-to-speech settings',
      enabled: 'Enable text-to-speech voice playback',
      type: 'Select a TTS service',
      rate: 'Rate',
      pitch: 'Pitch',
      language: 'Select a text-to-speech voice',
      unsupported: {
        text: 'Text-to-Speech is only available on the {link}. {kaomoji}',
        link: 'website version',
        kaomoji: '(^・ω・^)',
      },
    },
    appearance: {
      title: 'Appearance',
      description: 'Change the appearance of the app',
      theme: 'Theme',
      footer: 'Footer Settings',
      footer_size: {
        hint: 'Footer size',
        options: [
          {
            title: 'Small',
            value: 0,
          },
          {
            title: 'Large',
            value: 1,
          },
        ],
      },
      text: {
        title: 'Text Settings',
        font_family: 'Font family',
        font_type: 'Type',
        font_size: 'Font Size',
        outline: {
          enabled: 'Text outline',
          size: 'Text outline size',
          color: 'Text outline color',
        },
        fade: 'Fade text',
        fade_after: 'Fade text after',
        seconds: 'seconds',
        fade_for: 'Fade text for',
        new_line_delay: {
          hint: 'Start a new line when no text is sent',
          options: [
            {
              title: 'Instantly',
              value: 0,
            },
            {
              title: 'after 2 seconds',
              value: 2,
            },
            {
              title: 'after 4 seconds',
              value: 4,
            },
            {
              title: 'after 6 seconds',
              value: 6,
            },
            {
              title: 'after 8 seconds',
              value: 8,
            },
            {
              title: 'after 10 seconds',
              value: 10,
            },
            {
              title: 'Never',
              value: -1,
            },
          ],
        },
        color: 'Text color',
        interim_color: 'Interim text color',
      },
      ui: {
        title: 'UI Settings',
        color: 'Background color',
      },
    },
    word_replace: {
      title: 'Word Replace',
      description: 'Add words or phrases to replace here',
      enabled: 'Enable replacing words or phrases',
      match_whole_word: 'Match whole word only',
      match_case: 'Match case',
      info: 'Use the {icon} button to add a new replacement!',
      replacing: 'Replacing',
      replacement: 'Replacement',
    },
    translation: {
      title: 'Translations',
      description: 'Settings for translating to another language',
      warning: 'Translations are a work in progress. Do not trust them as perfect!',
      enabled: 'Enable translations',
      type: 'Select a translation service',
      source: 'Source',
      target: 'Target',
      show_original: 'Show original phrase before translating',
      ml_notice: '{0} is an ML-powered library that uses local compute resources (CPU) to generate translations on your device. On lower end computers, it might not run well.',
      speech_lang: 'Your Speech-to-text language is ',
      unsupported: {
        text: 'Translations are currently only available on the {link}. {kaomoji}',
        link: 'desktop version',
        kaomoji: '(^・ω・^)',
      },
    },
    connections: {
      title: 'Connections',
      description: 'Send data to other applications when using {icon}',
      action: {
        add: 'Use the {icon} button to add a new connection',
      },
      http_server: {
        title: 'HTTP Display Server',
        running: 'Server running on port {port}',
        stopped: 'Server stopped',
      },
      info: {
        title: 'Network Connection Info',
        description: 'Other devices can connect using these URLs',
        local_addresses: 'Local IP Addresses',
        no_interfaces: 'No network interfaces found',
      },
      dialog: {
        title: {
          add: 'Add connection',
          edit: 'Edit connection',
        },
        description: {
          websocket: 'Send text updates over a websocket',
          webhook: 'Send text updates over a webhook POST request',
        },
        field: {
          title: 'Title',
          type: 'Type',
          address: 'Address',
          port: 'Port',
          password: 'Password',
          password_placeholder: 'If server authentication is disabled, leave this field empty.',
          full_address: 'Full address',
        },
        action: {
          cancel: 'Cancel',
          confirm: 'Confirm',
          delete: 'Delete',
        },
      },
    },
  },
}
