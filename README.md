# Нет монет — QR Bill Payment (Wireflow Prototype)

Интерактивный мобильный прототип сценария «Pay for My Own Dish» без логина.

## Как запустить

Вариант 1: открыть файл напрямую
- Откройте `index.html` в браузере.

Вариант 2: локальный сервер
```bash
python3 -m http.server 5173
```
Затем откройте `http://localhost:5173`.

## Что реализовано
- Полный сценарий экранов: BILL_OVERVIEW → PAYMENT_STRATEGY → ITEM_SELECTION → CONFIRM_SELECTION → TIPS → PAYMENT → SUCCESS
- Реальные состояния позиций: доступно / занято / оплачено
- Блокировка оплаченных позиций после успешной оплаты
- Подсчет суммы, чаевых и финальной оплаты
- Мок обновлений в реальном времени (имитация занятых позиций)

## Публикация на GitHub
```bash
git init
git add .
git commit -m "Add wireflow prototype"
git branch -M main
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```
