type Subscription = { close: () => void };

class SubscriptionManager {
  private subs: Map<string, Subscription> = new Map();

  add(id: string, sub: Subscription): void {
    // Close existing sub with same id
    this.close(id);
    this.subs.set(id, sub);
  }

  close(id: string): void {
    const sub = this.subs.get(id);
    if (sub) {
      sub.close();
      this.subs.delete(id);
    }
  }

  closeAll(): void {
    for (const sub of this.subs.values()) {
      sub.close();
    }
    this.subs.clear();
  }

  get activeCount(): number {
    return this.subs.size;
  }
}

export const subscriptionManager = new SubscriptionManager();
