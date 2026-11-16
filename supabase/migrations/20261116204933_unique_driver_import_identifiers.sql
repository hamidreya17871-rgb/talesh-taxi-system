create unique index if not exists drivers_national_code_unique_idx
  on public.drivers (national_code)
  where national_code is not null and btrim(national_code) <> '';

create unique index if not exists drivers_phone_unique_idx
  on public.drivers (phone)
  where phone is not null and btrim(phone) <> '';

create unique index if not exists vehicles_plate_unique_idx
  on public.vehicles (plate)
  where plate is not null and btrim(plate) <> '';

create unique index if not exists vehicles_taxi_row_no_unique_idx
  on public.vehicles (taxi_row_no)
  where taxi_row_no is not null and btrim(taxi_row_no) <> '';
