"""Thin FHIR R4 client over HAPI. Just what Loop needs: search, read, create, transaction."""
from __future__ import annotations

from urllib.parse import urlencode

import httpx

from .config import FHIR_BASE

_HEADERS = {"Accept": "application/fhir+json", "Content-Type": "application/fhir+json"}


class FhirClient:
    def __init__(self, base: str = FHIR_BASE, timeout: float = 30.0):
        self.base = base.rstrip("/")
        self._client = httpx.Client(timeout=timeout, headers=_HEADERS)

    def search(self, resource_type: str, params: dict | None = None, max_pages: int = 5) -> list[dict]:
        """Return resource entries across pages (bounded).

        Builds the query string with slashes left raw — HAPI's reference search
        params (focus=Observation/123, based-on=ServiceRequest/123) do not match
        when the slash is percent-encoded, which is httpx's default for params=.
        """
        out: list[dict] = []
        qs = urlencode(params or {}, safe="/:")
        url = f"{self.base}/{resource_type}" + (f"?{qs}" if qs else "")
        page = 0
        while url and page < max_pages:
            r = self._client.get(url)
            r.raise_for_status()
            bundle = r.json()
            for entry in bundle.get("entry", []):
                res = entry.get("resource")
                if res:
                    out.append(res)
            url = _next_link(bundle)
            page += 1
        return out

    def read(self, resource_type: str, rid: str) -> dict | None:
        r = self._client.get(f"{self.base}/{resource_type}/{rid}")
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()

    def create(self, resource: dict) -> dict:
        rt = resource["resourceType"]
        r = self._client.post(f"{self.base}/{rt}", json=resource)
        r.raise_for_status()
        return r.json()

    def transaction(self, bundle: dict) -> dict:
        r = self._client.post(self.base, json=bundle)
        r.raise_for_status()
        return r.json()

    def metadata_ok(self) -> bool:
        try:
            r = self._client.get(f"{self.base}/metadata")
            return r.status_code == 200
        except httpx.HTTPError:
            return False


def _next_link(bundle: dict) -> str | None:
    for link in bundle.get("link", []):
        if link.get("relation") == "next":
            return link.get("url")
    return None
