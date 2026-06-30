# Дизайн: обзор/поиск чужих колод + подписки + единый широкий контейнер

- **Дата:** 2026-06-30
- **Репозитории:** бэкенд `AnkiBackendCopy` (Express + MongoDB/Mongoose), фронт `AnkiFrontCopy` (Next.js app router, next-intl, shadcn/ui, Tailwind v4)
- **Статус:** утверждён к реализации

## 1. Цель

Две задачи:

1. **Единый широкий контейнер** по всему приложению — одинаковая максимальная ширина и боковые отступы на всех страницах (сейчас каждая страница задаёт свою `max-w-Nxl`, из-за чего ширина «прыгает» и кажется узкой).
2. **Обзор и поиск чужих публичных колод** + возможность **добавить колоду к себе** (через подписку, без копирования) + красивая страница в стиле приложения.

## 2. Ключевые решения (утверждены)

- **«Добавить к себе» = подписка/закладка**, НЕ копирование. Подписчик учится по оригинальным карточкам, прогресс изучения — свой. Если автор изменит/удалит колоду — это отразится у подписчика.
- **Точка входа поиска** — отдельный пункт меню «Обзор» (`/explore`).
- **Ширина контейнера** — почти на всю ширину: `max-w-screen-2xl` с боковыми отступами.
- **Сохранённые колоды** — вкладка на странице `/decks` («Мои» / «Сохранённые»).
- **Дефолтная сортировка обзора** — `new` (сначала новые).

## 3. Что уже есть в коде (фундамент)

- `Deck` имеет `visibility: 'private' | 'public' | 'unlisted'` ([Deck.js](../../../src/models/Deck.js)).
- `deckService.assertCanAccessDeck(deck, authUser)` уже пускает к любой **не-приватной** колоде ([deckService.js](../../../src/services/deckService.js)).
- **Изучение чужих колод уже работает:** `reviewService.getDueCards` / `getNewCards` используют `loadAccessibleDeckCardIds` → `assertCanAccessDeck`, а `Review` хранится по паре `(user, card)` (уникальный индекс `{user, card}`). Значит подписчик сразу может учиться со своим прогрессом ([reviewService.js](../../../src/services/reviewService.js), [Review.js](../../../src/models/Review.js)).
- Карточки (`Card`) — общие сущности, привязаны к колоде через `DeckCard` ([DeckCard.js](../../../src/models/DeckCard.js)).
- Ответы API — «сырые» (DTO или массив), без обёртки `{ data, status }` (см. шапку `anki.types.ts` на фронте).
- Фронт: shadcn/ui (есть готовые `command`, `input`, `pagination`, `tabs`, `skeleton`, `empty`), кастомные `anki`-компоненты, пиксельная тема (`--radius: 0`, кастомные тени), i18n через next-intl (`en.json` / `uk.json`).

**Вывод:** фича чисто **дополняющая** — существующую логерботу менять не нужно, только добавляем.

## 4. Бэкенд

### 4.1 Новая модель `DeckSubscription`

Файл: `src/models/DeckSubscription.js`

```
{
  user: ObjectId(ref User, required),
  deck: ObjectId(ref Deck, required),
}
{ timestamps: true }  // createdAt используем как "saved at"
```

Индексы:
- `{ user: 1, deck: 1 }` — `unique` (одна подписка на пару).
- `{ deck: 1 }` — для подсчёта подписчиков.
- `{ user: 1, createdAt: -1 }` — для списка «Сохранённые».

Существующие модели **не меняются**.

### 4.2 Репозиторий `src/repository/deckSubscription.js`

Чистые функции над моделью (стиль как в `deck.js` / `deckCard.js`):
- `create({ userId, deckId })` — с обработкой дубликата (`code 11000` → вернуть существующую, идемпотентность).
- `deleteOne({ userId, deckId })` → boolean.
- `exists({ userId, deckId })` → boolean.
- `listByUser(userId)` → подписки пользователя, сортировка `createdAt: -1`.
- `findSubscribedDeckIds({ userId, deckIds })` → подмножество `deckIds`, на которые подписан (для флага `isSubscribed` в списках).
- `countByDeck(deckId)` и/или `countByDecks(deckIds)` (агрегация `$group`) — число подписчиков (для `popular` и отображения).

### 4.3 Репозиторий `src/repository/deck.js` — добавить

- `searchPublic({ q, sort, skip, limit })` — публичные колоды с поиском и пагинацией.
  - Фильтр: `{ visibility: 'public' }` + если `q` непустой: `$or: [{ name: regex }, { description: regex }]`, где `regex = new RegExp(escapeRegExp(q), 'i')` (поиск «содержит», регистронезависимо). Экранирование спецсимволов обязательно.
  - Сортировка: `new` → `{ createdAt: -1, _id: -1 }`; `name` → `{ name: 1 }`; `popular` обрабатывается на уровне сервиса/агрегации (по `subscriberCount`).
  - Возвращает страницу документов + общий `total` (через `countDocuments` с тем же фильтром).
  - Для `popular` сортировки и для эффективного подсчёта `subscriberCount`/`cardCount` без N+1 — использовать **aggregation pipeline** в репозитории `deck.js` (или отдельную функцию `searchPublicAggregated`): `$match` → `$lookup` (deckcards для `cardCount`, decksubscriptions для `subscriberCount`, users для автора) + `$addFields` счётчиков → `$sort` → `$skip`/`$limit`. Имя автора = `User.name`, аватар = `User.avatar` (поля подтверждены по [User.js](../../../src/models/User.js)).
- (опц.) индекс на `{ visibility: 1, createdAt: -1 }` для сортировки `new` по публичным.

### 4.4 Сервис `src/services/deckSubscriptionService.js` (или дополнить `deckService.js`)

- `subscribe(authUser, deckId)`:
  - `assertAuth`, `assertObjectId`.
  - Загрузить колоду (`loadDeckOr404`).
  - Запрет: нельзя подписаться на **свою** колоду (`isOwner` → `DomainError 400/409`), нельзя на **приватную** (`visibility === 'private'` → 404, как и доступ).
  - `deckSubscriptionRepository.create(...)` (идемпотентно).
  - Вернуть `{ deckId, subscribed: true }`.
- `unsubscribe(authUser, deckId)` → `{ deckId, subscribed: false }`.
- `listSavedDecks(authUser)`:
  - подписки → их `deckId` → загрузить колоды → для каждой `cardCount` (через `deckCardRepository.countByDeck`, как в существующем `withCardCount`) + `ownerName`.
  - Вернуть массив `SavedDeckDTO` (DeckDTO + `ownerName`, `subscribedAt`).
- `exploreDecks(authUser, { q, sort, page, pageSize })`:
  - нормализовать/валидировать `page>=1`, `1<=pageSize<=50` (дефолт 24), `sort ∈ {new, popular, name}` (дефолт `new`), `q` обрезать/ограничить длину.
  - получить страницу публичных колод + `total` + `subscriberCount` + `cardCount` + `ownerName`.
  - если залогинен — пометить `isSubscribed` (через `findSubscribedDeckIds`) и `isOwner`; иначе оба `false`.
  - вернуть `{ items: ExploreDeckDTO[], total, page, pageSize }`.

### 4.5 DTO `src/dto/`

- Расширить/добавить в `deckDto.js`:
  - `toExploreDeckDTO(doc, { cardCount, subscriberCount, ownerName, isSubscribed, isOwner })`.
  - `toSavedDeckDTO(doc, { cardCount, ownerName, subscribedAt })`.
- `ExploreDeckDTO`: `id, name, description, ownerId, ownerName, ownerAvatar, visibility, cardCount, subscriberCount, createdAt, isSubscribed, isOwner`.

### 4.6 Контроллеры и маршруты

`src/controllers/deckController.js` — добавить обработчики `explore`, `subscribe`, `unsubscribe`, `listSaved` (паттерн try/catch + `ok/created` + `httpResponseError`, как в существующих).

`src/routes/subroutes/deckRoutes.js` — добавить маршруты. **Важно про порядок:** статические пути регистрировать ДО `/:deckId`, иначе Express примет `explore`/`saved` за `deckId`.

```
router.get('/explore', optionalAuth, deckController.explore);   // выше /:deckId
router.get('/saved',   requireAuth,  deckController.listSaved);  // выше /:deckId
// ...существующие /:deckId ниже...
router.post('/:deckId/subscribe',   requireAuth, deckController.subscribe);
router.delete('/:deckId/subscribe', requireAuth, deckController.unsubscribe);
```

### 4.7 Формат ответа и конвенция

- Все новые эндпоинты, кроме `explore`, — «сырые» (объект/массив), как принято в проекте.
- `GET /decks/explore` отдаёт `{ items, total, page, pageSize }` — **осознанное локальное исключение** ради пагинации (это «результат поиска», а не DTO ресурса). Зафиксировать в комментарии и в типах фронта.

## 5. Фронт

### 5.1 Единый контейнер

- Новый `components/page-container.tsx`:
  ```tsx
  // mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8
  ```
  `flex-1 flex-col` — чтобы полноэкранные центрированные страницы (dashboard, study) продолжали работать.
- Подключить **один раз** в [`app/[locale]/(app)/layout.tsx`](../../../../AnkiFrontCopy/app/[locale]/(app)/layout.tsx): обернуть `{children}` в `<PageContainer>`.
- Убрать из страниц их собственные обёртки ширины/паддинга, оставить вертикальный ритм:
  - `decks/page.tsx`: `mx-auto max-w-6xl p-4 sm:p-6` → удалить (оставить `space-y`/`mb-*`).
  - `decks/[deckId]/page.tsx`: `mx-auto max-w-5xl ... p-4 sm:p-6` → удалить (несколько мест, включая ветки loading/notFound).
  - `decks/[deckId]/words/page.tsx`: `mx-auto max-w-4xl ... p-4 sm:p-6` → удалить.
  - `dashboard/page.tsx`: оставить центрирование (`flex-1 ... items-center justify-center`), убрать только лишний внешний паддинг при необходимости.
  - `study/page.tsx` → `StudySession`: проверить, что центрирование внутри совместимо с контейнером; при необходимости подправить.
- Лендинг (`(public-app)`/landing) и auth-страницы — **вне scope** (не трогаем).

### 5.2 Sidebar: пункт «Обзор»

[`components/app-sidebar.tsx`](../../../../AnkiFrontCopy/components/app-sidebar.tsx) — добавить в `NAV_ITEMS`:
```
{ href: '/explore', icon: Compass /* или Telescope/Search */, labelKey: 'nav.explore' }
```

### 5.3 Страница `/explore`

`app/[locale]/(app)/explore/page.tsx` (client component):
- Состояние из URL query (`q`, `sort`, `page`) — как в `words/page.tsx` (`useSearchParams` + `router.replace`), чтобы поиск был шарящимся и переживал ребилд.
- Поле поиска (`ui/input` или `ui/input-group` с иконкой) с **debounce** (~300–400мс) → обновляет `q` в URL, сбрасывает `page=1`.
- Переключатель сортировки (`new` / `popular` / `name`) — кнопка/`select`.
- Сетка карточек публичных колод (как `decks` grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`), скелетоны при загрузке, `Empty`-состояние при пустом результате/пустом запросе.
- **Серверная** пагинация через `ui/pagination` (как в `words/page.tsx`, но страницы приходят с бэка; рисуем по `total`/`pageSize`).
- Данные: `deckApi.explore({ queryParams: { q, sort, page, pageSize } })`.

### 5.4 Компонент карточки обзора

`components/anki/explore-deck-card.tsx`:
- Показывает: название (ссылка на `/decks/:id`), автор (`ownerName`), кол-во карточек, кол-во подписчиков, бейдж видимости (опц.).
- Кнопка **«Добавить» / «Добавлено»** (toggle): вызывает `deckApi.subscribe` / `deckApi.unsubscribe`, оптимистично обновляет `isSubscribed`, тост об успехе/ошибке (`useApiErrorToast`, `sonner`).
- Если `isOwner` — вместо кнопки подписки показать пометку «ваша колода» (подписаться на свою нельзя).

### 5.5 Страница `/decks`: вкладки «Мои» / «Сохранённые»

`app/[locale]/(app)/decks/page.tsx`:
- Обернуть в `ui/tabs`: вкладка «Мои» (текущий `deckApi.list`), вкладка «Сохранённые» (`deckApi.listSaved`).
- «Сохранённые» рендерит карточки колод (переиспользовать `DeckCard` или лёгкий вариант без меню edit/delete; показать автора и кнопку «Отписаться»). Уточнить в плане: переиспользовать `DeckCard` с пропом `variant`/`readOnly` или новый компонент `SavedDeckCard`.

### 5.6 Просмотр чужой (подписанной) колоды `/decks/:id`

`app/[locale]/(app)/decks/[deckId]/page.tsx`:
- Определить владельца: сравнить `deck.ownerId` с текущим пользователем (`useUser()` из `lib/auth/user-provider`).
- Если **не владелец** (read-only режим):
  - спрятать `QuickAddCard`, edit/remove на `DeckCardEntryItem`, edit/delete самой колоды;
  - показать «автор: `ownerName`» (нужно получить имя — либо из explore-переходов, либо добавить `ownerName` в `getById`/отдельным запросом; в плане решить минимальным способом);
  - показать кнопку «Учить» (работает) и toggle подписки.
- Текущий `DeckDetailPage` уже грузит deck через `getById` (optionalAuth → публичные доступны) и `listCards` (доступны) — менять загрузку не нужно, только условный рендер.

### 5.7 API-клиент и типы

[`services/configs/deck.config.ts`](../../../../AnkiFrontCopy/services/configs/deck.config.ts) — добавить эндпоинты:
- `explore: endpoint<void, ExploreResult>({ url: () => '/api/decks/explore', method: getData })` (query передаётся через `queryParams`).
- `listSaved: endpoint<void, SavedDeckDTO[]>({ url: () => '/api/decks/saved', method: getData })`.
- `subscribe: endpoint<void, SubscribeResult>({ url: ({deckId}) => '/api/decks/${deckId}/subscribe', method: postData })`.
- `unsubscribe: endpoint<void, SubscribeResult>({ url: ({deckId}) => '/api/decks/${deckId}/subscribe', method: deleteData })`.

[`services/configs/anki.types.ts`](../../../../AnkiFrontCopy/services/configs/anki.types.ts) — добавить типы: `ExploreDeckDTO`, `ExploreResult { items, total, page, pageSize }`, `SavedDeckDTO`, `SubscribeResult { deckId, subscribed }`, `ExploreSort = 'new'|'popular'|'name'`. Реэкспортнуть из `services/index.ts`.

### 5.8 i18n

`i18n/messages/en.json` и `uk.json` (раздел `anki`) — добавить ключи:
- `nav.explore`
- `explore.title`, `explore.subtitle`, `explore.searchPlaceholder`, `explore.empty`, `explore.emptyHint`, `explore.sort.new`, `explore.sort.popular`, `explore.sort.name`, `explore.cards`, `explore.subscribers`, `explore.add`, `explore.added`, `explore.yourDeck`
- `decks.tabs.mine`, `decks.tabs.saved`, `decks.savedEmpty`
- `deck.by`, `deck.readonlyHint`, `deck.subscribe`, `deck.unsubscribe`, `deck.subscribed`, `deck.unsubscribed`

(Точные ключи финализировать при реализации; следить за консистентностью EN/UK.)

## 6. Тестирование / проверка

**Бэкенд:**
- `subscribe`: успех на public; запрет на private (404); запрет на свою (400/409); идемпотентность (повторный POST не плодит дубли).
- `unsubscribe`: успех; на несуществующую подписку — корректный ответ.
- `explore`: фильтрует только public; поиск `q` по name+description (регистронезависимо, «содержит», спецсимволы экранируются); сортировки `new`/`popular`/`name`; пагинация (`total`, границы); флаги `isSubscribed`/`isOwner` для залогиненного и анонима.
- `listSaved`: отдаёт подписанные с `cardCount`/`ownerName`.
- Порядок маршрутов: `/explore` и `/saved` не перехватываются `/:deckId`.

**Фронт (ручной флоу):**
- Sidebar → «Обзор» → поиск → «Добавить» → колода появляется во вкладке «Сохранённые» → открыть → «Учить» работает, прогресс свой → «Отписаться» убирает из «Сохранённых».
- Контейнер: одинаковая ширина/отступы на dashboard, decks, deck, words, study, explore; адаптив на мобильном не сломан.
- Read-only режим чужой колоды: нет кнопок добавления/редактирования/удаления.

## 7. Вне scope

- Копирование/форк колод (выбран вариант «подписка»).
- Лендинг и auth-страницы (контейнер только в `(app)`).
- Рейтинги/отзывы на колоды, теги/категории каталога, рекомендации.
- Денормализация счётчиков (`subscriberCount` считаем агрегацией; кэш/счётчики-поля — позже при необходимости).
