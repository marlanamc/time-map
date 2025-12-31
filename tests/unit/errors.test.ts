import {
  AuthenticationError,
  DatabaseError,
  NetworkError,
  StorageError,
} from "../../src/services/errors";

describe("errors", () => {
  test("sets name fields", () => {
    expect(new AuthenticationError().name).toBe("AuthenticationError");
    expect(new DatabaseError("x").name).toBe("DatabaseError");
    expect(new StorageError("x").name).toBe("StorageError");
    expect(new NetworkError("x").name).toBe("NetworkError");
  });

  test("DatabaseError preserves cause", () => {
    const cause = new Error("root");
    const err = new DatabaseError("wrapped", cause);
    expect(err.cause).toBe(cause);
  });
});

