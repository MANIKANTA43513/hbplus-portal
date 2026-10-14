// Silence the SDK's expected console noise in tests; failures still surface as assertions.
jest.spyOn(console, 'warn').mockImplementation(() => undefined);
