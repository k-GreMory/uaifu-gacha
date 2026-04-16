from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from wtforms.validators import AnyOf, DataRequired, InputRequired, Length, NumberRange

import models


ALLOWED_SEASON_TASK_TYPES = ("spins", "unique_cards", "premium_spins")


def _non_negative(message: str = "Значення не може бути від'ємним"):
    return [NumberRange(min=0, message=message)]


def _positive(message: str = "Значення має бути більше нуля"):
    return [NumberRange(min=1, message=message)]


def _required_text(max_length: int = 255, message: str = "Поле обов'язкове"):
    validators = [DataRequired(message=message)]
    if max_length:
        validators.append(Length(max=max_length))
    return validators


def _required_task_type():
    return [
        DataRequired(message="Вкажіть тип завдання"),
        AnyOf(
            list(ALLOWED_SEASON_TASK_TYPES),
            message=(
                "Невідомий тип завдання. Дозволені значення: "
                + ", ".join(ALLOWED_SEASON_TASK_TYPES)
            ),
        ),
    ]


class AdminAuth(AuthenticationBackend):
    def __init__(self, admin_secret: str):
        super().__init__(secret_key=admin_secret)
        self.admin_secret = admin_secret

    async def login(self, request: Request) -> bool:
        form = await request.form()
        secret = form.get("username")
        if self.admin_secret and secret == self.admin_secret:
            request.session.update({"token": secret})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("token")
        if not self.admin_secret or not token or token != self.admin_secret:
            return False
        return True


class UserAdmin(ModelView, model=models.User):
    name = "Користувач"
    name_plural = "Користувачі"
    icon = "fa-solid fa-user"
    column_list = [models.User.id, models.User.username, models.User.first_name, models.User.coins, models.User.energy, models.User.total_spins, models.User.referred_by]
    search_fields = ["username", "first_name", "id"]
    inline_models = [models.UserCard]


class CardAdmin(ModelView, model=models.Card):
    name = "Персонаж"
    name_plural = "Персонажі"
    icon = "fa-solid fa-image"
    column_list = [models.Card.id, models.Card.name, models.Card.rarity, models.Card.image]
    search_fields = ["name", "id"]


class UserCardAdmin(ModelView, model=models.UserCard):
    name = "Колекція"
    name_plural = "Колекції"
    icon = "fa-solid fa-box"
    column_list = [models.UserCard.id, models.UserCard.user_id, models.UserCard.card_id, models.UserCard.duplicates, models.UserCard.acquired_at]
    search_fields = ["user_id", "card_id"]


class SpinLogAdmin(ModelView, model=models.SpinLog):
    name = "Лог Спінів"
    name_plural = "Логи Спінів"
    icon = "fa-solid fa-list"
    column_list = [models.SpinLog.id, models.SpinLog.user_id, models.SpinLog.card_id, models.SpinLog.is_duplicate, models.SpinLog.timestamp]
    search_fields = ["user_id", "card_id"]


class PurchaseLogAdmin(ModelView, model=models.PurchaseLog):
    name = "Лог Покупок"
    name_plural = "Логи Покупок"
    icon = "fa-solid fa-cart-shopping"
    column_list = [models.PurchaseLog.id, models.PurchaseLog.user_id, models.PurchaseLog.item, models.PurchaseLog.cost, models.PurchaseLog.timestamp]
    search_fields = ["user_id", "item"]


class ReferralAdmin(ModelView, model=models.Referral):
    name = "Реферал"
    name_plural = "Реферали"
    icon = "fa-solid fa-link"
    column_list = ["id", "referrer_id", "invited_id", "rewarded", "created_at"]


class GameBalanceConfigAdmin(ModelView, model=models.GameBalanceConfig):
    name = "Баланс"
    name_plural = "Баланс"
    icon = "fa-solid fa-sliders"
    column_list = [
        "id",
        "name",
        "is_active",
        "premium_spin_cost",
        "energy_purchase_cost",
        "pity_threshold",
        "updated_at",
    ]
    search_fields = ["name"]
    form_excluded_columns = ["created_at", "updated_at"]
    form_args = {
        "name": {"validators": _required_text(message="Назва конфігурації обов'язкова")},
        "daily_reward_base_coins": {"validators": _non_negative()},
        "daily_reward_energy_bonus": {"validators": _non_negative()},
        "daily_reward_max_coins": {"validators": _non_negative()},
        "daily_reward_streak_step_coins": {"validators": _non_negative()},
        "drone_score_per_coin": {"validators": _positive()},
        "energy_purchase_amount": {"validators": _positive()},
        "energy_purchase_cost": {"validators": _non_negative()},
        "premium_spin_cost": {"validators": _non_negative()},
        "pity_threshold": {
            "validators": _positive(
                message="Pity threshold має бути більше нуля, інакше логіка піті ламається"
            )
        },
        "premium_rare_chance": {"validators": _non_negative()},
        "premium_epic_chance": {"validators": _non_negative()},
        "premium_legendary_chance": {"validators": _non_negative()},
        "premium_mythic_chance": {"validators": _non_negative()},
        "pity_legendary_chance": {"validators": _non_negative()},
        "pity_mythic_chance": {"validators": _non_negative()},
        "referrer_reward_coins": {"validators": _non_negative()},
        "referrer_reward_energy": {"validators": _non_negative()},
        "new_user_reward_coins": {"validators": _non_negative()},
        "new_user_reward_energy": {"validators": _non_negative()},
        "standard_duplicate_common": {"validators": _non_negative()},
        "standard_duplicate_uncommon": {"validators": _non_negative()},
        "standard_duplicate_rare": {"validators": _non_negative()},
        "standard_duplicate_epic": {"validators": _non_negative()},
        "standard_duplicate_legendary": {"validators": _non_negative()},
        "standard_duplicate_mythic": {"validators": _non_negative()},
        "sell_duplicate_common": {"validators": _non_negative()},
        "sell_duplicate_uncommon": {"validators": _non_negative()},
        "sell_duplicate_rare": {"validators": _non_negative()},
        "sell_duplicate_epic": {"validators": _non_negative()},
        "sell_duplicate_legendary": {"validators": _non_negative()},
        "sell_duplicate_mythic": {"validators": _non_negative()},
    }

    async def on_model_change(self, data, model, is_created, request) -> None:
        premium_total = sum(
            int(data.get(field, 0) or 0)
            for field in (
                "premium_rare_chance",
                "premium_epic_chance",
                "premium_legendary_chance",
                "premium_mythic_chance",
            )
        )
        if premium_total <= 0:
            raise ValueError(
                "Сума преміум-шансів має бути більше нуля — інакше преміум-спін зависне у нескінченному циклі."
            )

        pity_total = sum(
            int(data.get(field, 0) or 0)
            for field in ("pity_legendary_chance", "pity_mythic_chance")
        )
        if pity_total <= 0:
            raise ValueError(
                "Сума піті-шансів має бути більше нуля — інакше піті-винагорода не зможе обратися."
            )


class SeasonTemplateAdmin(ModelView, model=models.SeasonTemplate):
    name = "Шаблон Сезону"
    name_plural = "Шаблони Сезонів"
    icon = "fa-solid fa-calendar-days"
    column_list = ["id", "code", "name", "duration_days", "is_active", "updated_at"]
    search_fields = ["code", "name"]
    form_excluded_columns = ["created_at", "updated_at"]
    inline_models = [models.SeasonTemplateTask]
    form_args = {
        "code": {
            "validators": _required_text(
                max_length=64, message="Код шаблону обов'язковий"
            )
        },
        "name": {
            "validators": _required_text(message="Назва шаблону обов'язкова")
        },
        "duration_days": {
            "validators": _positive(
                message="Тривалість сезону має бути принаймні 1 день"
            )
        },
    }

    async def on_model_change(self, data, model, is_created, request) -> None:
        code = (data.get("code") or "").strip()
        if not code:
            raise ValueError("Код шаблону обов'язковий.")

        with self.session_maker() as session:
            query = session.query(models.SeasonTemplate).filter(
                models.SeasonTemplate.code == code
            )
            pk = getattr(model, "id", None)
            if not is_created and pk is not None:
                query = query.filter(models.SeasonTemplate.id != pk)
            if query.first() is not None:
                raise ValueError(
                    f"Шаблон сезону з кодом '{code}' вже існує. Оберіть інший код."
                )


class SeasonTemplateTaskAdmin(ModelView, model=models.SeasonTemplateTask):
    name = "Завдання Шаблону"
    name_plural = "Завдання Шаблонів"
    icon = "fa-solid fa-list-check"
    column_list = ["id", "template_id", "sort_order", "title", "task_type", "target", "reward_coins", "reward_energy"]
    form_args = {
        "title": {
            "validators": _required_text(message="Назва завдання обов'язкова")
        },
        "task_type": {"validators": _required_task_type()},
        "target": {
            "validators": _positive(
                message="Ціль завдання має бути більше нуля"
            )
        },
        "reward_coins": {"validators": _non_negative()},
        "reward_energy": {"validators": _non_negative()},
        "sort_order": {"validators": _non_negative()},
    }


class SeasonAdmin(ModelView, model=models.Season):
    name = "Сезон"
    name_plural = "Сезони"
    icon = "fa-solid fa-calendar"
    column_list = ["id", "name", "start_date", "end_date", "is_active"]
    form_args = {
        "name": {
            "validators": _required_text(message="Назва сезону обов'язкова")
        },
        "start_date": {
            "validators": [InputRequired(message="Вкажіть дату старту сезону")]
        },
        "end_date": {
            "validators": [InputRequired(message="Вкажіть дату завершення сезону")]
        },
    }

    async def on_model_change(self, data, model, is_created, request) -> None:
        start = data.get("start_date")
        end = data.get("end_date")
        if start and end and end <= start:
            raise ValueError(
                "Дата завершення сезону має бути пізніше дати старту."
            )


class SeasonTaskAdmin(ModelView, model=models.SeasonTask):
    name = "Завдання Сезону"
    name_plural = "Завдання Сезону"
    icon = "fa-solid fa-check-double"
    column_list = ["id", "season_id", "title", "reward_coins", "reward_energy"]
    form_args = {
        "title": {
            "validators": _required_text(message="Назва завдання обов'язкова")
        },
        "task_type": {"validators": _required_task_type()},
        "target": {
            "validators": _positive(
                message="Ціль завдання має бути більше нуля"
            )
        },
        "reward_coins": {"validators": _non_negative()},
        "reward_energy": {"validators": _non_negative()},
    }


def setup_admin(app, engine, templates_dir: str, admin_secret: str, admin_enabled: bool):
    if not admin_enabled or not admin_secret:
        print("[config] Admin UI disabled because ADMIN_SECRET is not configured or admin was disabled explicitly.")
        return None

    authentication_backend = AdminAuth(admin_secret=admin_secret)
    admin = Admin(
        app,
        engine,
        authentication_backend=authentication_backend,
        templates_dir=templates_dir,
        title="UAIFU Admin",
    )

    admin.add_view(UserAdmin)
    admin.add_view(CardAdmin)
    admin.add_view(UserCardAdmin)
    admin.add_view(SpinLogAdmin)
    admin.add_view(PurchaseLogAdmin)
    admin.add_view(ReferralAdmin)
    admin.add_view(GameBalanceConfigAdmin)
    admin.add_view(SeasonTemplateAdmin)
    admin.add_view(SeasonTemplateTaskAdmin)
    admin.add_view(SeasonAdmin)
    admin.add_view(SeasonTaskAdmin)
    return admin
