const screens = {
  BILL_OVERVIEW: "bill",
  PAYMENT_STRATEGY: "strategy",
  ITEM_SELECTION: "items",
  CONFIRM_SELECTION: "confirm",
  TIPS: "tips",
  PAYMENT: "payment",
  SUCCESS: "success",
};

const state = {
  screen: screens.BILL_OVERVIEW,
  strategy: "items",
  items: [
    {
      id: "pasta",
      name: "Паста с трюфелем",
      imageUrl:
        "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80",
      price: 680,
      status: "available",
      state: "available",
    },
    {
      id: "salmon",
      name: "Лосось с киноа",
      imageUrl:
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80",
      price: 780,
      status: "available",
      state: "available",
    },
    {
      id: "wine",
      name: "Бутылка вина",
      imageUrl:
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80",
      price: 1900,
      status: "available",
      state: "available",
      shared: [1, 0.5, 0.33],
    },
    {
      id: "dessert",
      name: "Десерт дня",
      imageUrl:
        "https://images.unsplash.com/photo-1481391032119-d89fee407e44?w=600&auto=format&fit=crop&q=80",
      price: 420,
      status: "available",
      state: "available",
    },
  ],
  selection: {},
  tipPercent: 10,
  tipCustom: "",
  paymentMethod: "sbp",
  paidAt: null,
  activeUsers: 3,
};

const root = document.getElementById("screen-root");

const format = (amount) => `${amount.toFixed(0)} ₽`;

const subtotal = () => {
  return Object.values(state.selection).reduce((sum, entry) => {
    return sum + entry.amount;
  }, 0);
};

const tipAmount = () => {
  const base = subtotal();
  if (state.tipCustom !== "") {
    const custom = Number(state.tipCustom);
    return Number.isFinite(custom) ? custom : 0;
  }
  return Math.round((base * state.tipPercent) / 100);
};

const totalPayable = () => subtotal() + tipAmount();

const remainingBill = () => {
  const total = state.items.reduce((sum, item) => sum + item.price, 0);
  const paid = state.items
    .filter((item) => item.status === "locked")
    .reduce((sum, item) => sum + item.price, 0);
  return total - paid;
};

const setScreen = (screen) => {
  state.screen = screen;
  render();
};

const setStrategy = (strategy) => {
  state.strategy = strategy;
  state.selection = {};
  render();
};

const selectItem = (item, fraction = 1) => {
  if (item.status !== "available") return;
  const amount = Math.round(item.price * fraction);
  state.selection[item.id] = {
    id: item.id,
    name: item.name,
    amount,
    fraction,
  };
  item.state = "selected_by_user";
  render();
};

const deselectItem = (itemId) => {
  const item = state.items.find((entry) => entry.id === itemId);
  if (item && item.status === "available") {
    item.state = "available";
  }
  delete state.selection[itemId];
  render();
};

const hasSelection = () => Object.keys(state.selection).length > 0;

const prepareSelectionForStrategy = () => {
  if (state.strategy === "all") {
    if (!hasSelection()) {
      state.items
        .filter((item) => item.status === "available")
        .forEach((item) => {
          state.selection[item.id] = {
            id: item.id,
            name: item.name,
            amount: item.price,
            fraction: 1,
          };
          item.state = "selected_by_user";
        });
    }
  }

  if (state.strategy === "split") {
    state.selection = {
      split: {
        id: "split",
        name: "Равный вклад",
        amount: Math.round(remainingBill() / state.activeUsers),
        fraction: 1,
      },
    };
  }
};

const lockSelection = () => {
  Object.keys(state.selection).forEach((itemId) => {
    const item = state.items.find((entry) => entry.id === itemId);
    if (item) {
      item.status = "locked";
      item.state = "selected_by_other";
      item.paidBy = "Вы";
      item.paidAt = new Date();
    }
  });
};

const renderBillOverview = () => {
  root.innerHTML = `
    <section class="card bill-card">
      <div class="bill-card__left">
        <div class="bill-card__title-row">
          <h1 class="bill-card__title">Стол №12</h1>
          <span class="bill-card__badge">заказ продолжается</span>
        </div>
        <div class="bill-card__meta">Активный счёт</div>
        <div class="bill-card__submeta">Открыт: 08 Января 01:04</div>
        <div class="bill-card__total">
          <span class="bill-card__total-label">Общий счёт</span>
          <span class="bill-card__total-value">${format(remainingBill())}</span>
        </div>
      </div>
      <div class="bill-card__right">
        <div class="bill-card__qr">
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=table-12"
            alt="QR code"
          />
        </div>
      </div>
    </section>

    <div class="helper-text">
      Выберите блюда, которые вы заказывали — вы оплатите только их
    </div>

    <section class="item-list">
      ${state.items.map(renderEntryItem).join("")}
    </section>

    <div class="sticky-actions">
      <button class="cta cta--primary" id="pay-selected" ${
        hasSelection() ? "" : "disabled"
      }>
        Оплатить выбранное
      </button>
      <button class="cta cta--dark" id="split-bill">Разделить счёт</button>
      <button class="cta cta--ghost" id="pay-all">Оплатить всё</button>
    </div>
  `;

  document.querySelectorAll(".entry-item").forEach((itemEl) => {
    const itemId = itemEl.dataset.id;
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item || item.state === "selected_by_other") return;
    itemEl.onclick = () => {
      if (state.selection[itemId]) {
        deselectItem(itemId);
      } else {
        selectItem(item, 1);
      }
    };
  });

  document.getElementById("pay-selected").onclick = () => {
    if (!hasSelection()) return;
    setScreen(screens.CONFIRM_SELECTION);
  };
  document.getElementById("split-bill").onclick = () => {
    setStrategy("split");
    setScreen(screens.ITEM_SELECTION);
  };
  document.getElementById("pay-all").onclick = () => {
    setStrategy("all");
    setScreen(screens.ITEM_SELECTION);
  };
};

const renderStrategy = () => {
  root.innerHTML = `
    <section class="card">
      <h1 class="card__title">Как будете платить?</h1>
      <p class="card__subtitle">Выберите удобный сценарий.</p>
      <div class="option-list">
        ${renderOption("items", "Оплатить свои позиции", "По умолчанию")}
        ${renderOption("split", "Разделить поровну", "Все гости")}
        ${renderOption("all", "Оплатить весь счёт", "Полная оплата")}
      </div>
    </section>
    <section class="card">
      <button class="cta cta--primary" id="continue-strategy">Продолжить</button>
    </section>
  `;

  document.querySelectorAll(".option").forEach((option) => {
    option.onclick = () => setStrategy(option.dataset.value);
  });

  document.getElementById("continue-strategy").onclick = () =>
    setScreen(screens.ITEM_SELECTION);
};

const renderOption = (value, label, meta) => {
  const active = state.strategy === value ? "active" : "";
  return `
    <div class="option ${active}" data-value="${value}">
      <div class="option__left">
        <div class="dot"></div>
        <div>
          <div>${label}</div>
          <div class="small">${meta}</div>
        </div>
      </div>
      <div>›</div>
    </div>
  `;
};

const renderEntryItem = (item) => {
  const disabled = item.state === "selected_by_other" ? "disabled" : "";
  const selected = item.state === "selected_by_user" ? "selected" : "";
  const paidText =
    item.status === "locked" && item.paidAt
      ? `${item.paidBy || "Гость"} · ${item.paidAt.toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "";

  return `
    <div class="entry-item ${disabled} ${selected}" data-id="${item.id}">
      <img class="entry-item__image" src="${item.imageUrl}" alt="${item.name}" />
      <div class="entry-item__info">
        <div class="entry-item__title">${item.name}</div>
        <div class="entry-item__price">${format(item.price)}</div>
        ${paidText ? `<div class="entry-item__meta">${paidText}</div>` : ""}
      </div>
      <div class="entry-item__right">
        <div class="entry-item__check"></div>
      </div>
    </div>
  `;
};

const renderItems = () => {
  prepareSelectionForStrategy();
  const splitMode = state.strategy === "split";
  const allMode = state.strategy === "all";

  root.innerHTML = `
    <section class="card">
      <h1 class="card__title">Выберите свои позиции</h1>
      <p class="card__subtitle">${
        splitMode
          ? "Делим счёт поровну — позиции выбирать не нужно."
          : allMode
          ? "Мы выбрали все свободные позиции."
          : "Доступны только свободные позиции."
      }</p>
      ${
        splitMode
          ? `<div class="note">Сумма рассчитана от текущего остатка счёта.</div>`
          : `<div class="list">${state.items.map(renderItem).join("")}</div>`
      }
    </section>

    <div class="sticky">
      <div class="footer-card">
        <div>
          <div class="small">Выбрано</div>
          <strong>${format(subtotal())}</strong>
        </div>
        <button class="cta cta--primary" id="continue-items" ${
          hasSelection() ? "" : "disabled"
        }>
          Продолжить
        </button>
      </div>
    </div>
  `;

  document.querySelectorAll(".item").forEach((itemEl) => {
    const itemId = itemEl.dataset.id;
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item || item.status !== "available") return;

    itemEl.querySelectorAll(".chip").forEach((chip) => {
      const fraction = Number(chip.dataset.fraction);
      chip.onclick = () => selectItem(item, fraction);
    });

    const toggle = itemEl.querySelector(".item__toggle");
    if (toggle) {
      toggle.onclick = () =>
        state.selection[itemId]
          ? deselectItem(itemId)
          : selectItem(item, 1);
    }
  });

  const continueBtn = document.getElementById("continue-items");
  if (continueBtn) {
    continueBtn.onclick = () => {
      if (!hasSelection()) return;
      setScreen(screens.CONFIRM_SELECTION);
    };
  }
};

const renderItem = (item) => {
  const isSelected = Boolean(state.selection[item.id]);
  const disabled = item.status !== "available" ? "disabled" : "";
  const statusText =
    item.status === "claimed_by_other"
      ? `Занято: ${item.claimedBy}`
      : item.status === "locked"
      ? "Оплачено"
      : "Доступно";
  const chips = item.shared
    ? item.shared
        .map((fraction) => {
          const labelMap = {
            1: "Полная",
            0.5: "1/2",
            0.33: "1/3",
          };
          const label = labelMap[fraction] || `${fraction}`;
          const active =
            state.selection[item.id]?.fraction === fraction ? "active" : "";
          return `<button class="chip ${active}" data-fraction="${fraction}">${label}</button>`;
        })
        .join("")
    : "";

  return `
    <div class="item ${disabled}" data-id="${item.id}">
      <div class="item__row">
        <div>
          <div class="item__name">${item.name}</div>
          <div class="item__meta">${statusText}</div>
        </div>
        <strong>${format(item.price)}</strong>
      </div>
      <div class="item__actions">
        ${chips}
        ${ 
          item.shared
            ? ""
            : `<button class="chip item__toggle">${
                isSelected ? "Убрать" : "Выбрать"
              }</button>`
        }
      </div>
    </div>
  `;
};

const renderConfirm = () => {
  const selectionList = Object.values(state.selection)
    .map(
      (item) => `
        <div class="item__row">
          <div>${item.name}</div>
          <strong>${format(item.amount)}</strong>
        </div>
      `
    )
    .join("");

  root.innerHTML = `
    <section class="card">
      <h1 class="card__title">Подтвердите выбор</h1>
      <p class="card__subtitle">Позиции будут заблокированы для других гостей.</p>
      <div class="list">${selectionList}</div>
      <div class="status">
        <div>Итого</div>
        <strong>${format(subtotal())}</strong>
      </div>
      <div class="note" style="margin-top: 14px;">
        После подтверждения эти позиции станут недоступны другим гостям.
      </div>
    </section>
    <section class="card inline-actions">
      <button class="cta cta--ghost" id="back-items">Назад</button>
      <button class="cta cta--primary" id="proceed-payment">К оплате</button>
    </section>
  `;

  document.getElementById("back-items").onclick = () =>
    setScreen(screens.ITEM_SELECTION);
  document.getElementById("proceed-payment").onclick = () =>
    setScreen(screens.TIPS);
};

const renderTips = () => {
  root.innerHTML = `
    <section class="card">
      <h1 class="card__title">Чаевые</h1>
      <p class="card__subtitle">Чаевые считаются только от вашей суммы.</p>
      <div class="tip-grid">
        ${renderTip(0)}
        ${renderTip(5)}
        ${renderTip(10)}
        <div class="tip ${state.tipCustom !== "" ? "active" : ""}" data-tip="custom">Своя сумма</div>
      </div>
      <input
        class="input"
        type="number"
        placeholder="Введите сумму, ₽"
        id="tip-input"
        value="${state.tipCustom}"
      />
    </section>
    <section class="card">
      <button class="cta cta--primary" id="continue-tips">Продолжить</button>
    </section>
  `;

  document.querySelectorAll(".tip").forEach((tip) => {
    tip.onclick = () => {
      const value = tip.dataset.tip;
      if (value === "custom") {
        state.tipCustom = state.tipCustom === "" ? "" : state.tipCustom;
      } else {
        state.tipPercent = Number(value);
        state.tipCustom = "";
      }
      render();
    };
  });

  const input = document.getElementById("tip-input");
  input.oninput = (event) => {
    state.tipCustom = event.target.value;
    render();
  };

  document.getElementById("continue-tips").onclick = () =>
    setScreen(screens.PAYMENT);
};

const renderTip = (value) => {
  const active = state.tipCustom === "" && state.tipPercent === value ? "active" : "";
  return `<div class="tip ${active}" data-tip="${value}">${value}%</div>`;
};

const renderPayment = () => {
  root.innerHTML = `
    <section class="card">
      <h1 class="card__title">Оплата</h1>
      <p class="card__subtitle">Вы оплачиваете только выбранные позиции.</p>
      <div class="status">
        <div>К оплате</div>
        <strong>${format(totalPayable())}</strong>
      </div>
      <div class="note" style="margin-top: 14px;">
        После оплаты официант получит уведомление автоматически.
      </div>
    </section>
    <section class="card">
      <div class="payment-methods">
        ${renderPaymentMethod("sbp", "СБП")}
        ${renderPaymentMethod("wallet", "Apple Pay / Google Pay")}
        ${renderPaymentMethod("card", "Банковская карта")}
      </div>
    </section>
    <section class="card">
      <button class="cta cta--primary" id="pay">Оплатить ${format(
        totalPayable()
      )}</button>
    </section>
  `;

  document.querySelectorAll(".payment-method").forEach((method) => {
    method.onclick = () => {
      state.paymentMethod = method.dataset.method;
      render();
    };
  });

  document.getElementById("pay").onclick = () => {
    lockSelection();
    state.paidAt = new Date();
    setScreen(screens.SUCCESS);
  };
};

const renderPaymentMethod = (id, label) => {
  const active = state.paymentMethod === id ? "active" : "";
  return `
    <div class="payment-method ${active}" data-method="${id}">
      <div>${label}</div>
      <div>${active ? "Выбрано" : ""}</div>
    </div>
  `;
};

const renderSuccess = () => {
  const selectionList = Object.values(state.selection)
    .map(
      (item) => `
        <div class="item__row">
          <div>${item.name}</div>
          <strong>${format(item.amount)}</strong>
        </div>
      `
    )
    .join("");
  const time = state.paidAt
    ? state.paidAt.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  root.innerHTML = `
    <section class="card success">
      <div class="success__icon">✓</div>
      <h1 class="card__title">Оплата прошла</h1>
      <p class="card__subtitle">Официант уже получил уведомление.</p>
      <div class="list">${selectionList}</div>
      <div class="status">
        <div>Чаевые</div>
        <strong>${format(tipAmount())}</strong>
      </div>
      <div class="status" style="margin-top: 8px;">
        <div>Время</div>
        <strong>${time}</strong>
      </div>
      <div class="note" style="margin-top: 14px;">
        Остаток по счёту: ${format(remainingBill())}
      </div>
    </section>
    <section class="card">
      <button class="cta cta--primary" id="back-bill">Назад к счёту</button>
    </section>
  `;

  document.getElementById("back-bill").onclick = () => {
    state.selection = {};
    setScreen(screens.BILL_OVERVIEW);
  };
};

const render = () => {
  switch (state.screen) {
    case screens.BILL_OVERVIEW:
      renderBillOverview();
      break;
    case screens.PAYMENT_STRATEGY:
      renderStrategy();
      break;
    case screens.ITEM_SELECTION:
      renderItems();
      break;
    case screens.CONFIRM_SELECTION:
      renderConfirm();
      break;
    case screens.TIPS:
      renderTips();
      break;
    case screens.PAYMENT:
      renderPayment();
      break;
    case screens.SUCCESS:
      renderSuccess();
      break;
    default:
      renderBillOverview();
  }
};

const simulateOtherUser = () => {
  const available = state.items.filter((item) => item.status === "available");
  if (available.length === 0) return;
  const pick = available[Math.floor(Math.random() * available.length)];
  pick.status = "claimed_by_other";
  pick.claimedBy = "Гость";
  pick.state = "selected_by_other";
  state.activeUsers = Math.max(2, state.activeUsers - 1);
  if (state.selection[pick.id]) delete state.selection[pick.id];
  render();
};

setInterval(() => {
  if (state.screen === screens.ITEM_SELECTION && Math.random() > 0.85) {
    simulateOtherUser();
  }
}, 4000);

render();
