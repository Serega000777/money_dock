# Нативный релиз Amola Finance

## Что уже подготовлено

- Expo-конфигурация содержит bundle id/package `app.amola.finance`, версии сборок,
  иконку, splash, разрешение микрофона и Sign in with Apple.
- Production-профили EAS находятся в `apps/app/eas.json`; API сборки направлен на
  `https://amola-finance.ru/api`.
- Голосовая запись работает через нативный `expo-audio`, а не через браузерный
  `MediaRecorder`; лёгкая отдача цифровой клавиатуры работает через `expo-haptics`.
- Access/refresh-токены нативной версии хранятся в iOS Keychain / Android Keystore через
  `expo-secure-store`. Тема и состояние онбординга сохраняются в AsyncStorage.
- Добавлен настоящий Sign in with Apple: сервер проверяет подпись, issuer и audience
  identity token по публичным ключам Apple.
- CSV выбирается системным file picker, аватар — системным photo picker.
- В iOS скрыты Telegram Stars, СБП и другие внешние способы оплаты Pro: цифровая
  подписка в App Store должна продаваться через StoreKit/IAP.

## Сборка для Xcode / TestFlight

На Mac из корня репозитория:

```bash
pnpm install --frozen-lockfile
cd apps/app
npx eas-cli login
npx eas-cli build:configure
pnpm native:prebuild
pnpm ios
```

`pnpm native:prebuild` создаст `ios/` и `android/`. Открывать в Xcode нужно созданный
`ios/*.xcworkspace`, не `.xcodeproj`. Для облачной production-сборки без локального
Xcode: `pnpm eas:build:ios`, затем `npx eas-cli submit --platform ios --profile production`.

В Apple Developer нужно заранее зарегистрировать App ID `app.amola.finance`, включить
Sign in with Apple и создать приложение с тем же bundle id в App Store Connect.

## Блокеры перед отправкой на ревью

1. Создать auto-renewable subscription Amola Pro в App Store Connect и подключить
   StoreKit-покупку, проверку server notification/transaction и кнопку восстановления
   покупок. Product ID пока неизвестен, поэтому этот шаг нельзя корректно завершить в
   коде заранее. До него iOS показывает честное сообщение, а не внешнюю оплату.
2. Заменить production-ключ/провайдера распознавания речи. Текущий Gemini API key на
   сервере отвечает `403 Your project has been denied access`, поэтому запись работает,
   но сервер не может получить расшифровку.
3. Заполнить реальные сведения Оператора и обработчиков в `apps/app/src/legal/content.ts`,
   проверить политику у юриста и указать публичные Privacy Policy / Support URL в App
   Store Connect. Сейчас сведения Оператора намеренно оставлены плейсхолдерами.
4. Указать реальные `EXPO_PUBLIC_SUPPORT_TELEGRAM_URL` и
   `EXPO_PUBLIC_FEEDBACK_TELEGRAM_URL` для production-сборки.
5. На реальном iPhone проверить: первый/повторный Sign in with Apple, отказ в микрофоне,
   удержание кнопки записи, редактирование распознанного черновика, импорт CSV, удаление
   аккаунта, тёмную/светлую тему и восстановление сессии после перезапуска.

Нативную iOS-сборку и загрузку в TestFlight нельзя воспроизвести на Windows: для
локального Xcode нужен Mac, а для EAS нужны учётная запись Expo и доступ к Apple
Developer/App Store Connect.
