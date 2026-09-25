import { describe, expect, it } from "vitest";
import { Conversation } from "./conversation";

function pair(): [Conversation, Conversation] {
  return [new Conversation("aaaa"), new Conversation("bbbb")];
}

describe("turn-taking conversation", () => {
  it("lets ordinary speech hand back the turn without a modem acknowledgement", () => {
    const [assistant] = pair();
    assistant.send("packet");
    assistant.receiveSpeech();
    expect(assistant.turn).toBe("mine");
    expect(assistant.pending).toBeUndefined();
    assistant.sendSpeech();
    expect(assistant.turn).toBe("theirs");
    expect(assistant.pending).toBeUndefined();
    expect(() => assistant.sendSpeech()).toThrow("Wait for a reply");
    assistant.receiveSpeech();
    expect(assistant.send("encoded again").frame.sequence).toBe(1);
  });

  it("does not replay a spoken answer as a reply to an older encoded message", () => {
    const [sender, assistant] = pair();
    const packet = sender.send("hello");
    assistant.receive(packet.frame);
    assistant.receiveSpeech();
    assistant.sendSpeech();
    expect(assistant.receive(packet.frame)).toEqual({ kind: "duplicate" });
  });
  it("alternates turns between the two devices", () => {
    const [alice, bob] = pair();
    expect(alice.turn).toBe("mine");

    const hello = alice.send("hello");
    expect(alice.turn).toBe("theirs");
    expect(() => alice.send("again")).toThrow("Wait for a reply");

    expect(bob.receive(hello.frame)).toMatchObject({
      kind: "message",
      frame: { text: "hello" },
    });
    expect(bob.turn).toBe("mine");

    const reply = bob.send("hi back");
    const outcome = alice.receive(reply.frame);
    expect(outcome).toMatchObject({ kind: "message", acknowledges: hello });
    expect(alice.turn).toBe("mine");
    expect(alice.pending).toBeUndefined();
  });

  it("ignores its own transmissions picked up by the microphone", () => {
    const [alice] = pair();
    const hello = alice.send("hello");
    expect(alice.receive(hello.frame)).toEqual({ kind: "own" });
    expect(alice.turn).toBe("theirs");
  });

  it("drops duplicates of a message that has not been answered yet", () => {
    const [alice, bob] = pair();
    const hello = alice.send("hello");
    bob.receive(hello.frame);
    expect(bob.receive(hello.frame)).toEqual({ kind: "duplicate" });
  });

  it("re-sends the reply when the peer re-sends a message it already answered", () => {
    const [alice, bob] = pair();
    const hello = alice.send("hello");
    bob.receive(hello.frame);
    const reply = bob.send("hi back");

    // Alice never heard the reply and presses Resend.
    expect(alice.pending).toBe(hello);
    expect(bob.receive(hello.frame)).toEqual({
      kind: "resend-reply",
      message: reply,
    });

    expect(alice.receive(reply.frame)).toMatchObject({
      kind: "message",
      acknowledges: hello,
    });
  });

  it("recovers when both devices send at the same time", () => {
    const [alice, bob] = pair();
    const fromAlice = alice.send("hello");
    const fromBob = bob.send("hey");

    expect(alice.receive(fromBob.frame)).toMatchObject({ kind: "message" });
    expect(bob.receive(fromAlice.frame)).toMatchObject({ kind: "message" });
    expect(alice.turn).toBe("mine");
    expect(bob.turn).toBe("mine");
  });

  it("uses a new sequence number per message", () => {
    const [alice, bob] = pair();
    const first = alice.send("one");
    bob.receive(first.frame);
    alice.receive(bob.send("two").frame);
    expect(alice.send("three").frame.sequence).toBe(first.frame.sequence + 1);
  });
});

describe("manual conversation", () => {
  it("sends repeated encoded and spoken messages without a reply", () => {
    const manual = new Conversation("aaaa", true);
    const first = manual.send("first");
    const second = manual.send("second");
    manual.sendSpeech();
    const third = manual.send("third");

    expect([first, second, third].map((message) => message.frame.sequence)).toEqual([0, 1, 2]);
    expect(manual.turn).toBe("mine");
    expect(manual.pending).toBeUndefined();
  });

  it("accepts peer messages without treating them as acknowledgements", () => {
    const [manual, peer] = [new Conversation("aaaa", true), new Conversation("bbbb")];
    manual.send("first");
    manual.send("second");
    const incoming = peer.send("hello");

    expect(manual.receive(incoming.frame)).toMatchObject({
      kind: "message",
      acknowledges: undefined,
    });
    expect(manual.receive(incoming.frame)).toEqual({ kind: "duplicate" });
    expect(manual.send("third").frame.sequence).toBe(2);
  });
});
