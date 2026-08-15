import { Injectable } from '@nestjs/common';
import type { ShareLink } from '@swasthya/interop';

/**
 * Process-local stand-in for a real store, the same convention
 * `ReferralsRepository`/`EngagementRepository` already set: the
 * service/controller code above this does not change once the in-memory map
 * is swapped for real persistence, only this file does. Not
 * `@swasthya/interop`'s own `InMemoryShareLinkStore` — that class exists for
 * a future on-device share flow (see its doc comment), keyed only by token;
 * this repository also needs id and owner lookups for the controller's
 * "list/revoke my own share links" routes, so it stays a local class rather
 * than reusing a store shaped for a different caller.
 */
@Injectable()
export class InteropRepository {
  readonly #byId = new Map<string, ShareLink>();

  save(link: ShareLink): ShareLink {
    this.#byId.set(link.id, link);
    return link;
  }

  find(id: string): ShareLink | null {
    return this.#byId.get(id) ?? null;
  }

  findByToken(token: string): ShareLink | null {
    for (const link of this.#byId.values()) {
      if (link.token === token) return link;
    }
    return null;
  }

  listForOwner(ownerId: string): ShareLink[] {
    return [...this.#byId.values()].filter((link) => link.ownerId === ownerId);
  }
}
