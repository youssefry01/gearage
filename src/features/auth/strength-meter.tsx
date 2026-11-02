"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type Score = 0 | 1 | 2 | 3 | 4;
type Scorer = (password: string, userInputs: string[]) => Score;

let scorerPromise: Promise<Scorer> | undefined;

/** Loads zxcvbn-ts and its dictionaries on first use only, so they never weigh on pages without a password field. */
function loadScorer(): Promise<Scorer> {
  scorerPromise ??= (async () => {
    const [{ ZxcvbnFactory }, common, en] = await Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common"),
      import("@zxcvbn-ts/language-en"),
    ]);
    const factory = new ZxcvbnFactory({
      translations: en.translations,
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary },
    });
    return (password, userInputs) => factory.check(password, userInputs).score as Score;
  })();
  return scorerPromise;
}

const colors = ["bg-danger", "bg-danger", "bg-warning", "bg-success", "bg-success"] as const;

/**
 * Advisory strength meter (zxcvbn-ts). It NEVER decides anything: the server applies the real policy (length and the
 * breached-password check). The result is shown as text as well as colour, announced politely, and the password is
 * never sent anywhere. `userInputs` (name, email) are penalised as guessable.
 */
export function StrengthMeter({
  password,
  userInputs,
}: {
  password: string;
  userInputs: string[];
}) {
  const t = useTranslations("Auth.strength");
  const [score, setScore] = useState<Score | null>(null);
  const inputsKey = userInputs.join("\u0000");

  useEffect(() => {
    if (!password) return;
    let cancelled = false;
    void loadScorer().then((scorer) => {
      if (!cancelled) setScore(scorer(password, inputsKey ? inputsKey.split("\u0000") : []));
    });
    return () => {
      cancelled = true;
    };
  }, [password, inputsKey]);

  if (!password || score === null) return null;
  return (
    <div className="flex flex-col gap-1" data-testid="strength-meter">
      <div aria-hidden className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${score > i || (score === 4 && i < 4) ? colors[score] : "bg-muted"}`}
          />
        ))}
      </div>
      <p role="status" className="text-small text-muted-foreground">
        {t("label")}: <span className="text-foreground font-semibold">{t(`score${score}`)}</span>
      </p>
    </div>
  );
}
