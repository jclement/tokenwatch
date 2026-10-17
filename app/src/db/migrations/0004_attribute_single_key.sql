-- Events synced before 0003 carry no device key, and nothing else recorded
-- which key uploaded them. Where an account has exactly one paired key, give
-- them to it: the best available guess (a key deleted before today could have
-- sent some of them, and nothing records that). Accounts with several keys stay
-- Unattributed until each machine's agent (>= 0.4.0) re-sends its history.
UPDATE `events`
SET `device_id` = (SELECT `d`.`id` FROM `devices` `d` WHERE `d`.`user_id` = `events`.`user_id`)
WHERE `device_id` = ''
  AND (SELECT COUNT(*) FROM `devices` `d` WHERE `d`.`user_id` = `events`.`user_id`) = 1;
