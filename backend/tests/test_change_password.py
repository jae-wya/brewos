"""POST /auth/change-password, with both Supabase clients faked: nothing
here reaches the network. Run from backend/: python -m pytest"""
from types import SimpleNamespace as NS

import pytest
from fastapi.testclient import TestClient
from supabase_auth.errors import AuthApiError, AuthWeakPasswordError

from app.main import app
from app.routers import auth
from app.security import CurrentUser, require_owner

BIZ = "a0000000-0000-0000-0000-000000000001"
STAFF = "d9d9c944-6125-42ba-a2fa-17f63119befe"
AUTH_USER = "0ab5fa74-8205-42a0-80bc-5e50cc8db12a"
EMAIL = "owner@example.com"
CURRENT = "old-password-1"


class Query:
    """staff.select(...).eq(...).eq(...).limit(...).execute(), recording the filters."""
    def __init__(self, admin): self.admin, self.filters = admin, {}
    def select(self, *a): return self
    def eq(self, col, val): self.filters[col] = val; return self
    def limit(self, n): return self
    def execute(self):
        self.admin.staff_filters = self.filters
        match = self.filters == {"id": STAFF, "business_id": BIZ}
        return NS(data=[{"auth_user_id": self.admin.auth_user_id}] if match else [])


class FakeAdmin:
    def __init__(self, auth_user_id=AUTH_USER, update_error=None):
        self.auth_user_id, self.update_error = auth_user_id, update_error
        self.updates, self.staff_filters = [], None
        outer = self

        class Admin:
            def get_user_by_id(self, uid):
                assert uid == outer.auth_user_id
                return NS(user=NS(email=EMAIL))
            def update_user_by_id(self, uid, attrs):
                if outer.update_error: raise outer.update_error
                outer.updates.append((uid, attrs))

        class Auth:
            admin = Admin()
            def sign_in_with_password(self, creds):
                raise AssertionError("signed in on the admin client")  # CLAUDE.md
        self.auth = Auth()

    def table(self, name):
        assert name == "staff"
        return Query(self)


class FakeAnon:
    """A new one per get_supabase() call, like the real one."""
    sign_ins = []
    def __init__(self):
        class Auth:
            def sign_in_with_password(self, creds):
                FakeAnon.sign_ins.append(creds)
                if creds != {"email": EMAIL, "password": CURRENT}:
                    raise Exception("Invalid login credentials")
                return NS(user=NS(id=AUTH_USER))
        self.auth = Auth()


@pytest.fixture
def setup(monkeypatch):
    admin = FakeAdmin()
    FakeAnon.sign_ins = []
    monkeypatch.setattr(auth, "get_supabase_admin", lambda: admin)
    monkeypatch.setattr(auth, "get_supabase", FakeAnon)
    app.dependency_overrides[require_owner] = lambda: CurrentUser(staff_id=STAFF, business_id=BIZ, role="owner")
    yield admin
    app.dependency_overrides.clear()


client = TestClient(app, raise_server_exceptions=False)

def post(current, new):
    return client.post("/auth/change-password", json={"current_password": current, "new_password": new})


def test_changes_it(setup):
    r = post(CURRENT, "a-new-password")
    assert r.status_code == 200 and r.json() == {"changed": True}
    assert setup.updates == [(AUTH_USER, {"password": "a-new-password"})]
    assert FakeAnon.sign_ins == [{"email": EMAIL, "password": CURRENT}]   # verified on the anon client


def test_finds_the_login_from_her_staff_row_scoped_by_business(setup):
    post(CURRENT, "a-new-password")
    assert setup.staff_filters == {"id": STAFF, "business_id": BIZ}


def test_wrong_current_password(setup):
    r = post("not-it", "a-new-password")
    assert r.status_code == 400   # not 401: she's still logged in
    assert r.json()["detail"] == "Your current password is wrong."
    assert setup.updates == []


@pytest.mark.parametrize("new, message", [
    ("short", "New password must be at least 8 characters."),
    (" " * 10, "New password can't be only spaces."),
    ("x" * 73, "New password is too long. Keep it under 70 characters."),
])
def test_weak_new_password_is_refused_before_supabase(setup, new, message):
    r = post(CURRENT, new)
    assert r.status_code == 422 and r.json()["detail"] == message
    assert FakeAnon.sign_ins == [] and setup.updates == []


def test_same_as_current(setup):
    r = post(CURRENT, CURRENT)
    assert r.status_code == 422
    assert r.json()["detail"] == "New password must be different from the current one."
    assert FakeAnon.sign_ins == [] and setup.updates == []


@pytest.mark.parametrize("error", [
    AuthWeakPasswordError("Password is known to be weak and easy to guess.", 422, ["pwned"]),
    AuthApiError("Password is known to be weak and easy to guess.", 422, "weak_password"),
])
def test_supabase_says_too_weak(setup, error):
    setup.update_error = error
    r = post(CURRENT, "password123")
    assert r.status_code == 422
    assert r.json()["detail"] == "That password is too weak. Password is known to be weak and easy to guess."


def test_account_without_a_login(setup):
    setup.auth_user_id = None
    r = post(CURRENT, "a-new-password")
    assert r.status_code == 409 and FakeAnon.sign_ins == []
