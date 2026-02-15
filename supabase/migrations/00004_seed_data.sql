INSERT INTO benefit_types (benefit_type_code, benefit_type_name, description, required_documents, is_active) VALUES
  ('01', '結婚祝金', '会員本人または会員の子が結婚した場合に贈与。入会年数・初婚/再婚により金額が異なる。', '婚姻届受理証明書または戸籍謄本', TRUE),
  ('02', '出産祝金', '会員またはその配偶者が出産した場合に贈与。双生児以上は人数分加算。死産の場合は弔慰金として贈与。', '出生届受理証明書または母子手帳の写し', TRUE),
  ('03', '入学祝金', '会員の子が小学校に入学した場合に贈与。', '入学通知書の写しまたは在学証明書', TRUE),
  ('04', '傷病見舞金', '会員が傷病により連続7日以上欠勤した場合に贈与。標準報酬月額に応じた日額×欠勤日数で計算。', '医師の診断書、欠勤証明書', TRUE),
  ('05', '災害見舞金', '会員が火災・風水害等の災害を受けた場合に贈与。被害程度・自家/その他・世帯主/非世帯主により金額が異なる。', '罹災証明書', TRUE),
  ('06', '弔慰金', '会員本人または家族が死亡した場合に贈与。続柄・喪主/非喪主により金額が異なる。', '死亡診断書の写し、会葬礼状', TRUE),
  ('07', '脱会餞別金', '会員が退職等により脱会する場合に贈与。入会後3年未満は対象外。', '退職届の写し', TRUE),
  ('08', '定年退職記念品', '会員が定年退職する場合に記念品（10,000円相当）を贈与。', '退職届の写し（定年退職であることの証明）', TRUE)
ON CONFLICT (benefit_type_code) DO NOTHING;

INSERT INTO companies (company_code, company_name, company_name_kana, postal_code, address, phone, contact_name, contact_email, is_active) VALUES
  ('VT', 'VTホールディングス', 'ブイティーホールディングス', '450-0002', '愛知県名古屋市中村区名駅4-7-1', '052-218-6811', '稲生真一', 'inou@vt-holdings.co.jp', TRUE),
  ('NTP', 'ネッツトヨタ東名古屋', 'ネッツトヨタヒガシナゴヤ', '465-0025', '愛知県名古屋市名東区上社1-901', '052-773-2331', '鈴木太郎', 'suzuki@ntp.co.jp', TRUE),
  ('HND', 'ホンダカーズ東海', 'ホンダカーズトウカイ', '460-0003', '愛知県名古屋市中区錦2-4-15', '052-231-5500', '高橋一郎', 'takahashi@hondacars-tokai.co.jp', TRUE),
  ('KNT', '光洋自動車', 'コウヨウジドウシャ', '464-0075', '愛知県名古屋市千種区内山3-1-1', '052-732-0001', '佐藤次郎', 'sato@kouyou-jidousha.co.jp', TRUE),
  ('FLX', 'FLEXオートレビュー', 'フレックスオートレビュー', '460-0008', '愛知県名古屋市中区栄3-15-6', '052-251-8880', '山本三郎', 'yamamoto@flex-auto.co.jp', TRUE)
ON CONFLICT (company_code) DO NOTHING;

INSERT INTO approvers (approver_id, full_name, email, company_code, permission_level, is_active) VALUES
  ('APR-VT01', '稲生真一', 'inou@vt-holdings.co.jp', 'VT', 'hq', TRUE),
  ('APR-VT02', '中村恵子', 'nakamura@vt-holdings.co.jp', 'VT', 'company', TRUE),
  ('APR-NTP01', '鈴木太郎', 'suzuki@ntp.co.jp', 'NTP', 'company', TRUE),
  ('APR-HND01', '高橋一郎', 'takahashi@hondacars-tokai.co.jp', 'HND', 'company', TRUE),
  ('APR-KNT01', '佐藤次郎', 'sato@kouyou-jidousha.co.jp', 'KNT', 'company', TRUE),
  ('APR-FLX01', '山本三郎', 'yamamoto@flex-auto.co.jp', 'FLX', 'company', TRUE)
ON CONFLICT (approver_id) DO NOTHING;
