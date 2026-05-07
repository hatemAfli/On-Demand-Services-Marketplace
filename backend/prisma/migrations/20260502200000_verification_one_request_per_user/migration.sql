-- One verification profile request per applicant (user).
-- Remove duplicate rows from older "resubmit creates new request" behavior; keep the newest row per user.

DELETE FROM "documents" AS d
USING "verification_profil_requests" AS v
WHERE d."verification_request_id" = v."id"
  AND v."id" IN (
    SELECT x."id"
    FROM (
      SELECT
        "id",
        ROW_NUMBER() OVER (
          PARTITION BY "user_id"
          ORDER BY "created_at" DESC, "id" DESC
        ) AS rn
      FROM "verification_profil_requests"
    ) AS x
    WHERE x.rn > 1
  );

DELETE FROM "verification_profil_requests" AS v
WHERE v."id" IN (
  SELECT x."id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "user_id"
        ORDER BY "created_at" DESC, "id" DESC
      ) AS rn
    FROM "verification_profil_requests"
  ) AS x
  WHERE x.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "verification_profil_requests_user_id_key"
  ON "verification_profil_requests" ("user_id");
