from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

import models


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


class SeasonAdmin(ModelView, model=models.Season):
    name = "Сезон"
    name_plural = "Сезони"
    icon = "fa-solid fa-calendar"
    column_list = ["id", "name", "start_date", "end_date", "is_active"]


class SeasonTaskAdmin(ModelView, model=models.SeasonTask):
    name = "Завдання Сезону"
    name_plural = "Завдання Сезону"
    icon = "fa-solid fa-check-double"
    column_list = ["id", "season_id", "title", "reward_coins", "reward_energy"]


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
    admin.add_view(SeasonAdmin)
    admin.add_view(SeasonTaskAdmin)
    return admin
