# Деплой: Telegram Mini App на одном VPS

Весь стек — три контейнера на одной машине: Postgres (закрытый), API (закрытый) и Caddy,
который отдаёт статический экспорт приложения и сам получает HTTPS-сертификат. Всё
описано в `infrastructure/docker/docker-compose.prod.yml`; на сервере не нужно ни Node, ни
pnpm — только Docker.

Внутри Telegram пользователь входит молча по `initData` (см. `apps/app/src/auth/AuthProvider.tsx`);
онбординг и экран регистрации показываются только вне Telegram — это заготовка под отдельное
мобильное приложение и на Mini App не влияет. `/auth/dev-login` (демо-вход из браузера) в
production отвечает 404 — `NODE_ENV=production` выставлен в compose.

## Что нужно заранее

1. **VPS** с публичным IPv4, Ubuntu 22.04/24.04, 1 vCPU / 2 GB RAM хватит для старта.
   Важно, чтобы до сервера был доступ и из RU, и от серверов Telegram — российские
   провайдеры (reg.ru, Timeweb Cloud, Selectel, Yandex Cloud) подходят.
2. **Домен** (или поддомен, например `app.вашдомен.ru`) — A-запись на IP сервера.
   Подождите, пока `ping app.вашдомен.ru` отвечает с нового IP, иначе Let's Encrypt не
   выдаст сертификат.
3. **Бот в Telegram** — уже создан: **@amola_finance_bot**, его токен лежит в локальном
   `.env` и пойдёт в `.env.production` на сервере. Если бот понадобится новый —
   [@BotFather](https://t.me/BotFather) → `/newbot`.

### Если хостинг и домен на reg.ru

- **Сервер:** в личном кабинете reg.ru — «Серверы» → создать VPS/Cloud-сервер, ОС Ubuntu
  22.04 или 24.04, минимальный тариф с 2 GB RAM. После создания в карточке сервера будет
  публичный IP и доступ по SSH (root-пароль или ключ) — заходите: `ssh root@IP`.
- **Домен:** в карточке домена → управление DNS-зоной (домен должен использовать
  DNS-серверы reg.ru, `ns1.reg.ru`/`ns2.reg.ru`, это по умолчанию). Добавьте запись:
  тип **A**, имя (subdomain) **`app`**, значение — IP сервера, TTL можно оставить по
  умолчанию. Обновление зоны на reg.ru занимает обычно 5–15 минут; проверка —
  `nslookup app.вашдомен.ru` должен вернуть IP сервера.
- Сам домен (без `app.`) можно позже направить на тот же сервер или на лендинг — для Mini
  App достаточно поддомена.

## Сервер

```bash
# 1. Docker (официальный скрипт)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 2. Код
git clone https://github.com/Serega000777/money_dock.git
cd money_dock

# 3. Секреты
cp .env.production.example .env.production
nano .env.production
```

В `.env.production` четыре значения:

| Переменная           | Что вписать                                             |
| -------------------- | ------------------------------------------------------- |
| `DOMAIN`             | `app.вашдомен.ru` — без `https://`                      |
| `POSTGRES_PASSWORD`  | любая длинная случайная строка (`openssl rand -hex 24`) |
| `TELEGRAM_BOT_TOKEN` | токен из BotFather                                      |
| `JWT_ACCESS_SECRET`  | `openssl rand -hex 48`                                  |

```bash
# 4. Сборка и запуск (первая сборка ~5–10 минут: ставятся зависимости, собирается веб)
docker compose --env-file .env.production -f infrastructure/docker/docker-compose.prod.yml up -d --build

# 5. Проверка
docker compose --env-file .env.production -f infrastructure/docker/docker-compose.prod.yml ps
curl https://$DOMAIN/api/health      # {"status":"ok","db":"ok"}
curl -I https://$DOMAIN/             # HTTP/2 200
```

API при старте сам накатывает миграции и сидит системные категории (оба шага
идемпотентны), поэтому отдельного `db:migrate` на сервере нет.

## Подключение к Telegram

В @BotFather:

1. `/newapp` → выберите @amola_finance_bot → название «Amola Finance», короткое описание,
   картинка 640×360 → **Web App URL: `https://app.вашдомен.ru`** → короткое имя `amola`.
   Прямая ссылка на Mini App: `https://t.me/amola_finance_bot/amola`.
2. `/setmenubutton` → @amola_finance_bot → URL `https://app.вашдомен.ru` → текст кнопки,
   например «Открыть». Теперь Mini App открывается кнопкой рядом с полем ввода в чате с ботом.

Откройте бота в Telegram, нажмите кнопку — приложение должно открыться уже с вашим именем
из Telegram и пустыми счетами. Это боевой тест.

**После боевого теста — перевыпустить токен бота.** Токен один раз пересылался в
переписке, а это не приватное место: в @BotFather → `/revoke` → @amola_finance_bot → новый
токен → вписать в `.env.production` на сервере и в локальный `.env`, затем
`docker compose … up -d` (без `--build`), чтобы API перечитал переменную. Старый токен
перестанет работать в момент `/revoke`.

## Обновление

```bash
cd money_dock && git pull
docker compose --env-file .env.production -f infrastructure/docker/docker-compose.prod.yml up -d --build
```

Новые миграции применятся при старте API. Изменения на клиенте требуют пересборки образа
`web` (адрес API вшивается в бандл при сборке) — `--build` это делает.

## Бэкап и логи

```bash
# дамп базы
docker compose --env-file .env.production -f infrastructure/docker/docker-compose.prod.yml \
  exec -T postgres pg_dump -U postgres amola | gzip > backup-$(date +%F).sql.gz

# логи API / веба
docker compose --env-file .env.production -f infrastructure/docker/docker-compose.prod.yml logs -f api
docker compose --env-file .env.production -f infrastructure/docker/docker-compose.prod.yml logs -f web
```

## Если что-то не так

| Симптом                                                                                           | Причина / что делать                                                                     |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `web` перезапускается, в логах `obtaining certificate`                                            | DNS ещё не указывает на сервер или закрыт порт 80/443 (firewall). Проверьте `dig`/`ufw`. |
| `api` падает с `Invalid environment configuration`                                                | Не заполнена переменная в `.env.production` — в логе сказано, какая.                     |
| В Telegram открывается, но «Появится после подключения счетов» и нет данных                       | Приложение не достучалось до API: откройте `https://DOMAIN/api/health` в браузере.       |
| В Telegram `401 Telegram initData rejected`                                                       | `TELEGRAM_BOT_TOKEN` не от того бота, через которого открыт Mini App.                    |
| Открыл `https://DOMAIN` в обычном браузере — онбординг и «Продолжить без регистрации» не работает | Так и задумано: вне Telegram демо-вход в production выключен. Тестируйте из Telegram.    |

## Что осталось за рамками первой выкладки

- Yandex ID / VK ID — на экране регистрации отмечены «скоро», серверные заглушки отвечают 501.
- Регистрация по телефону/паролю — только форма, SMS-провайдера нет.
- Подключение банков — только импорт выписок CSV; API банков не подключены (см. ADR по
  `BankProvider`).
