-- Insert FIA anylish template structure ordered by canonical Bible book order
-- Generated from attached pericope JSON.
do $$ begin
  if not exists (
    select 1
    from public.template_structure
    where parent_id is null
      and template = 'fia'
      and language = 'any'
      and type = 'book'
      and item_id = 'gen'
  ) then

-- Genesis
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Genesis', 'gen', 88, 1000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 1:1-2:3', 'gen-p1', 34, 1001, '{"id":"gen-p1","sequence":1,"verseRange":"1:1-2:3","startChapter":1,"startVerse":1,"endChapter":2,"endVerse":3}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 2:4-25', 'gen-p2', 22, 1002, '{"id":"gen-p2","sequence":2,"verseRange":"2:4-25","startChapter":2,"startVerse":4,"endChapter":2,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 3:1-24', 'gen-p3', 24, 1003, '{"id":"gen-p3","sequence":3,"verseRange":"3:1-24","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 4:1-16', 'gen-p4a', 16, 1004, '{"id":"gen-p4a","sequence":4,"verseRange":"4:1-16","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 4:17-26', 'gen-p4b', 10, 1004, '{"id":"gen-p4b","sequence":4,"verseRange":"4:17-26","startChapter":4,"startVerse":17,"endChapter":4,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 5:1-32', 'gen-p5', 32, 1005, '{"id":"gen-p5","sequence":5,"verseRange":"5:1-32","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 6:1-8', 'gen-p6', 8, 1006, '{"id":"gen-p6","sequence":6,"verseRange":"6:1-8","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 6:9-22', 'gen-p7', 14, 1007, '{"id":"gen-p7","sequence":7,"verseRange":"6:9-22","startChapter":6,"startVerse":9,"endChapter":6,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 7:1-24', 'gen-p8', 24, 1008, '{"id":"gen-p8","sequence":8,"verseRange":"7:1-24","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 8:1-19', 'gen-p9', 19, 1009, '{"id":"gen-p9","sequence":9,"verseRange":"8:1-19","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 8:20-9:17', 'gen-p10', 20, 1010, '{"id":"gen-p10","sequence":10,"verseRange":"8:20-9:17","startChapter":8,"startVerse":20,"endChapter":9,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 9:18-29', 'gen-p11', 12, 1011, '{"id":"gen-p11","sequence":11,"verseRange":"9:18-29","startChapter":9,"startVerse":18,"endChapter":9,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 10:1-32', 'gen-p12', 32, 1012, '{"id":"gen-p12","sequence":12,"verseRange":"10:1-32","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 11:1-9', 'gen-p13', 9, 1013, '{"id":"gen-p13","sequence":13,"verseRange":"11:1-9","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 11:10-26', 'gen-p14', 17, 1014, '{"id":"gen-p14","sequence":14,"verseRange":"11:10-26","startChapter":11,"startVerse":10,"endChapter":11,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 11:27-32', 'gen-p15', 6, 1015, '{"id":"gen-p15","sequence":15,"verseRange":"11:27-32","startChapter":11,"startVerse":27,"endChapter":11,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 12:1-9', 'gen-p16', 9, 1016, '{"id":"gen-p16","sequence":16,"verseRange":"12:1-9","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 12:10-20', 'gen-p17', 11, 1017, '{"id":"gen-p17","sequence":17,"verseRange":"12:10-20","startChapter":12,"startVerse":10,"endChapter":12,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 13:1-18', 'gen-p18', 18, 1018, '{"id":"gen-p18","sequence":18,"verseRange":"13:1-18","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 14:1-16', 'gen-p19', 16, 1019, '{"id":"gen-p19","sequence":19,"verseRange":"14:1-16","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 14:17-24', 'gen-p20', 8, 1020, '{"id":"gen-p20","sequence":20,"verseRange":"14:17-24","startChapter":14,"startVerse":17,"endChapter":14,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 15:1-21', 'gen-p21', 21, 1021, '{"id":"gen-p21","sequence":21,"verseRange":"15:1-21","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 16:1-16', 'gen-p22', 16, 1022, '{"id":"gen-p22","sequence":22,"verseRange":"16:1-16","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 17:1-27', 'gen-p23', 27, 1023, '{"id":"gen-p23","sequence":23,"verseRange":"17:1-27","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 18:1-15', 'gen-p24', 15, 1024, '{"id":"gen-p24","sequence":24,"verseRange":"18:1-15","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 18:16-33', 'gen-p25', 18, 1025, '{"id":"gen-p25","sequence":25,"verseRange":"18:16-33","startChapter":18,"startVerse":16,"endChapter":18,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 19:1-29', 'gen-p26', 29, 1026, '{"id":"gen-p26","sequence":26,"verseRange":"19:1-29","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 19:30-38', 'gen-p27', 9, 1027, '{"id":"gen-p27","sequence":27,"verseRange":"19:30-38","startChapter":19,"startVerse":30,"endChapter":19,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 20:1-18', 'gen-p28', 18, 1028, '{"id":"gen-p28","sequence":28,"verseRange":"20:1-18","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 21:1-21', 'gen-p29', 21, 1029, '{"id":"gen-p29","sequence":29,"verseRange":"21:1-21","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 21:22-34', 'gen-p30', 13, 1030, '{"id":"gen-p30","sequence":30,"verseRange":"21:22-34","startChapter":21,"startVerse":22,"endChapter":21,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 22:1-19', 'gen-p31', 19, 1031, '{"id":"gen-p31","sequence":31,"verseRange":"22:1-19","startChapter":22,"startVerse":1,"endChapter":22,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 22:20-24', 'gen-p32', 5, 1032, '{"id":"gen-p32","sequence":32,"verseRange":"22:20-24","startChapter":22,"startVerse":20,"endChapter":22,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 23:1-20', 'gen-p33', 20, 1033, '{"id":"gen-p33","sequence":33,"verseRange":"23:1-20","startChapter":23,"startVerse":1,"endChapter":23,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 24:1-14', 'gen-p34a', 14, 1034, '{"id":"gen-p34a","sequence":34,"verseRange":"24:1-14","startChapter":24,"startVerse":1,"endChapter":24,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 24:15-28', 'gen-p34b', 14, 1034, '{"id":"gen-p34b","sequence":34,"verseRange":"24:15-28","startChapter":24,"startVerse":15,"endChapter":24,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 24:29-49', 'gen-p34c', 21, 1034, '{"id":"gen-p34c","sequence":34,"verseRange":"24:29-49","startChapter":24,"startVerse":29,"endChapter":24,"endVerse":49}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 24:50-61', 'gen-p34d', 12, 1034, '{"id":"gen-p34d","sequence":34,"verseRange":"24:50-61","startChapter":24,"startVerse":50,"endChapter":24,"endVerse":61}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 24:62-67', 'gen-p34e', 6, 1034, '{"id":"gen-p34e","sequence":34,"verseRange":"24:62-67","startChapter":24,"startVerse":62,"endChapter":24,"endVerse":67}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 25:1-11', 'gen-p35', 11, 1035, '{"id":"gen-p35","sequence":35,"verseRange":"25:1-11","startChapter":25,"startVerse":1,"endChapter":25,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 25:12-18', 'gen-p36', 7, 1036, '{"id":"gen-p36","sequence":36,"verseRange":"25:12-18","startChapter":25,"startVerse":12,"endChapter":25,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 25:19-34', 'gen-p37', 16, 1037, '{"id":"gen-p37","sequence":37,"verseRange":"25:19-34","startChapter":25,"startVerse":19,"endChapter":25,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 26:1-33', 'gen-p38', 33, 1038, '{"id":"gen-p38","sequence":38,"verseRange":"26:1-33","startChapter":26,"startVerse":1,"endChapter":26,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 26:34-27:17', 'gen-p39a', 19, 1039, '{"id":"gen-p39a","sequence":39,"verseRange":"26:34-27:17","startChapter":26,"startVerse":34,"endChapter":27,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 27:18-29', 'gen-p39b', 12, 1039, '{"id":"gen-p39b","sequence":39,"verseRange":"27:18-29","startChapter":27,"startVerse":18,"endChapter":27,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 27:30-40', 'gen-p39c', 11, 1039, '{"id":"gen-p39c","sequence":39,"verseRange":"27:30-40","startChapter":27,"startVerse":30,"endChapter":27,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 27:41-28:9', 'gen-p39d', 15, 1039, '{"id":"gen-p39d","sequence":39,"verseRange":"27:41-28:9","startChapter":27,"startVerse":41,"endChapter":28,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 28:10-22', 'gen-p40', 13, 1040, '{"id":"gen-p40","sequence":40,"verseRange":"28:10-22","startChapter":28,"startVerse":10,"endChapter":28,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 29:1-14', 'gen-p41', 14, 1041, '{"id":"gen-p41","sequence":41,"verseRange":"29:1-14","startChapter":29,"startVerse":1,"endChapter":29,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 29:15-30', 'gen-p42', 16, 1042, '{"id":"gen-p42","sequence":42,"verseRange":"29:15-30","startChapter":29,"startVerse":15,"endChapter":29,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 29:31-30:24', 'gen-p43', 29, 1043, '{"id":"gen-p43","sequence":43,"verseRange":"29:31-30:24","startChapter":29,"startVerse":31,"endChapter":30,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 30:25-43', 'gen-p44', 19, 1044, '{"id":"gen-p44","sequence":44,"verseRange":"30:25-43","startChapter":30,"startVerse":25,"endChapter":30,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 31:1-21', 'gen-p45', 21, 1045, '{"id":"gen-p45","sequence":45,"verseRange":"31:1-21","startChapter":31,"startVerse":1,"endChapter":31,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 31:22-35', 'gen-p46a', 14, 1046, '{"id":"gen-p46a","sequence":46,"verseRange":"31:22-35","startChapter":31,"startVerse":22,"endChapter":31,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 31:36-55', 'gen-p46b', 20, 1046, '{"id":"gen-p46b","sequence":46,"verseRange":"31:36-55","startChapter":31,"startVerse":36,"endChapter":31,"endVerse":55}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 32:1-21', 'gen-p47', 21, 1047, '{"id":"gen-p47","sequence":47,"verseRange":"32:1-21","startChapter":32,"startVerse":1,"endChapter":32,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 32:22-32', 'gen-p48', 11, 1048, '{"id":"gen-p48","sequence":48,"verseRange":"32:22-32","startChapter":32,"startVerse":22,"endChapter":32,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 33:1-20', 'gen-p49', 20, 1049, '{"id":"gen-p49","sequence":49,"verseRange":"33:1-20","startChapter":33,"startVerse":1,"endChapter":33,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 34:1-17', 'gen-p50a', 17, 1050, '{"id":"gen-p50a","sequence":50,"verseRange":"34:1-17","startChapter":34,"startVerse":1,"endChapter":34,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 34:18-31', 'gen-p50b', 14, 1050, '{"id":"gen-p50b","sequence":50,"verseRange":"34:18-31","startChapter":34,"startVerse":18,"endChapter":34,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 35:1-15', 'gen-p51', 15, 1051, '{"id":"gen-p51","sequence":51,"verseRange":"35:1-15","startChapter":35,"startVerse":1,"endChapter":35,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 35:16-20', 'gen-p52', 5, 1052, '{"id":"gen-p52","sequence":52,"verseRange":"35:16-20","startChapter":35,"startVerse":16,"endChapter":35,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 35:21-29', 'gen-p53', 9, 1053, '{"id":"gen-p53","sequence":53,"verseRange":"35:21-29","startChapter":35,"startVerse":21,"endChapter":35,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 36:1-19', 'gen-p54a', 19, 1054, '{"id":"gen-p54a","sequence":54,"verseRange":"36:1-19","startChapter":36,"startVerse":1,"endChapter":36,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 36:20-30', 'gen-p54b', 11, 1054, '{"id":"gen-p54b","sequence":54,"verseRange":"36:20-30","startChapter":36,"startVerse":20,"endChapter":36,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 36:31-43', 'gen-p54c', 13, 1054, '{"id":"gen-p54c","sequence":54,"verseRange":"36:31-43","startChapter":36,"startVerse":31,"endChapter":36,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 37:1-11', 'gen-p55', 11, 1055, '{"id":"gen-p55","sequence":55,"verseRange":"37:1-11","startChapter":37,"startVerse":1,"endChapter":37,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 37:12-36', 'gen-p56', 25, 1056, '{"id":"gen-p56","sequence":56,"verseRange":"37:12-36","startChapter":37,"startVerse":12,"endChapter":37,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 38:1-30', 'gen-p57', 30, 1057, '{"id":"gen-p57","sequence":57,"verseRange":"38:1-30","startChapter":38,"startVerse":1,"endChapter":38,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 39:1-23', 'gen-p58', 23, 1058, '{"id":"gen-p58","sequence":58,"verseRange":"39:1-23","startChapter":39,"startVerse":1,"endChapter":39,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 40:1-23', 'gen-p59', 23, 1059, '{"id":"gen-p59","sequence":59,"verseRange":"40:1-23","startChapter":40,"startVerse":1,"endChapter":40,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 41:1-36', 'gen-p60', 36, 1060, '{"id":"gen-p60","sequence":60,"verseRange":"41:1-36","startChapter":41,"startVerse":1,"endChapter":41,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 41:37-57', 'gen-p61', 21, 1061, '{"id":"gen-p61","sequence":61,"verseRange":"41:37-57","startChapter":41,"startVerse":37,"endChapter":41,"endVerse":57}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 42:1-26', 'gen-p62a', 26, 1062, '{"id":"gen-p62a","sequence":62,"verseRange":"42:1-26","startChapter":42,"startVerse":1,"endChapter":42,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 42:27-38', 'gen-p62b', 12, 1062, '{"id":"gen-p62b","sequence":62,"verseRange":"42:27-38","startChapter":42,"startVerse":27,"endChapter":42,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 43:1-34', 'gen-p63', 34, 1063, '{"id":"gen-p63","sequence":63,"verseRange":"43:1-34","startChapter":43,"startVerse":1,"endChapter":43,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 44:1-13', 'gen-p64a', 13, 1064, '{"id":"gen-p64a","sequence":64,"verseRange":"44:1-13","startChapter":44,"startVerse":1,"endChapter":44,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 44:14-34', 'gen-p64b', 21, 1064, '{"id":"gen-p64b","sequence":64,"verseRange":"44:14-34","startChapter":44,"startVerse":14,"endChapter":44,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 45:1-28', 'gen-p65', 28, 1065, '{"id":"gen-p65","sequence":65,"verseRange":"45:1-28","startChapter":45,"startVerse":1,"endChapter":45,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 46:1-27', 'gen-p66', 27, 1066, '{"id":"gen-p66","sequence":66,"verseRange":"46:1-27","startChapter":46,"startVerse":1,"endChapter":46,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 46:28-47:12', 'gen-p67', 19, 1067, '{"id":"gen-p67","sequence":67,"verseRange":"46:28-47:12","startChapter":46,"startVerse":28,"endChapter":47,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 47:13-26', 'gen-p68', 14, 1068, '{"id":"gen-p68","sequence":68,"verseRange":"47:13-26","startChapter":47,"startVerse":13,"endChapter":47,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 47:27-31', 'gen-p69', 5, 1069, '{"id":"gen-p69","sequence":69,"verseRange":"47:27-31","startChapter":47,"startVerse":27,"endChapter":47,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 48:1-22', 'gen-p70', 22, 1070, '{"id":"gen-p70","sequence":70,"verseRange":"48:1-22","startChapter":48,"startVerse":1,"endChapter":48,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 49:1-28', 'gen-p71', 28, 1071, '{"id":"gen-p71","sequence":71,"verseRange":"49:1-28","startChapter":49,"startVerse":1,"endChapter":49,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 49:29-50:14', 'gen-p72', 19, 1072, '{"id":"gen-p72","sequence":72,"verseRange":"49:29-50:14","startChapter":49,"startVerse":29,"endChapter":50,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 50:15-21', 'gen-p73', 7, 1073, '{"id":"gen-p73","sequence":73,"verseRange":"50:15-21","startChapter":50,"startVerse":15,"endChapter":50,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Genesis 50:22-26', 'gen-p74', 5, 1074, '{"id":"gen-p74","sequence":74,"verseRange":"50:22-26","startChapter":50,"startVerse":22,"endChapter":50,"endVerse":26}'::jsonb);

-- Exodus
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Exodus', 'exo', 113, 2000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 1:1-7', 'exo-p1', 7, 2001, '{"id":"exo-p1","sequence":1,"verseRange":"1:1-7","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 1:8-14', 'exo-p2', 7, 2002, '{"id":"exo-p2","sequence":2,"verseRange":"1:8-14","startChapter":1,"startVerse":8,"endChapter":1,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 1:15-22', 'exo-p3', 8, 2003, '{"id":"exo-p3","sequence":3,"verseRange":"1:15-22","startChapter":1,"startVerse":15,"endChapter":1,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 2:1-10', 'exo-p4', 10, 2004, '{"id":"exo-p4","sequence":4,"verseRange":"2:1-10","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 2:11-15', 'exo-p5', 5, 2005, '{"id":"exo-p5","sequence":5,"verseRange":"2:11-15","startChapter":2,"startVerse":11,"endChapter":2,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 2:16-25', 'exo-p6', 10, 2006, '{"id":"exo-p6","sequence":6,"verseRange":"2:16-25","startChapter":2,"startVerse":16,"endChapter":2,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 3:1-10', 'exo-p7', 10, 2007, '{"id":"exo-p7","sequence":7,"verseRange":"3:1-10","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 3:11-22', 'exo-p8', 12, 2008, '{"id":"exo-p8","sequence":8,"verseRange":"3:11-22","startChapter":3,"startVerse":11,"endChapter":3,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 4:1-17', 'exo-p9', 17, 2009, '{"id":"exo-p9","sequence":9,"verseRange":"4:1-17","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 4:18-31', 'exo-p10', 14, 2010, '{"id":"exo-p10","sequence":10,"verseRange":"4:18-31","startChapter":4,"startVerse":18,"endChapter":4,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 5:1-21', 'exo-p11', 21, 2011, '{"id":"exo-p11","sequence":11,"verseRange":"5:1-21","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 5:22-6:13', 'exo-p12', 15, 2012, '{"id":"exo-p12","sequence":12,"verseRange":"5:22-6:13","startChapter":5,"startVerse":22,"endChapter":6,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 6:14-27', 'exo-p13', 14, 2013, '{"id":"exo-p13","sequence":13,"verseRange":"6:14-27","startChapter":6,"startVerse":14,"endChapter":6,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 6:28-7:13', 'exo-p14', 16, 2014, '{"id":"exo-p14","sequence":14,"verseRange":"6:28-7:13","startChapter":6,"startVerse":28,"endChapter":7,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 7:14-25', 'exo-p15', 12, 2015, '{"id":"exo-p15","sequence":15,"verseRange":"7:14-25","startChapter":7,"startVerse":14,"endChapter":7,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 8:1-15', 'exo-p16', 15, 2016, '{"id":"exo-p16","sequence":16,"verseRange":"8:1-15","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 8:16-19', 'exo-p17', 4, 2017, '{"id":"exo-p17","sequence":17,"verseRange":"8:16-19","startChapter":8,"startVerse":16,"endChapter":8,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 8:20-32', 'exo-p18', 13, 2018, '{"id":"exo-p18","sequence":18,"verseRange":"8:20-32","startChapter":8,"startVerse":20,"endChapter":8,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 9:1-7', 'exo-p19', 7, 2019, '{"id":"exo-p19","sequence":19,"verseRange":"9:1-7","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 9:8-12', 'exo-p20', 5, 2020, '{"id":"exo-p20","sequence":20,"verseRange":"9:8-12","startChapter":9,"startVerse":8,"endChapter":9,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 9:13-21', 'exo-p21a', 9, 2021, '{"id":"exo-p21a","sequence":21,"verseRange":"9:13-21","startChapter":9,"startVerse":13,"endChapter":9,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 9:22-35', 'exo-p21b', 14, 2021, '{"id":"exo-p21b","sequence":21,"verseRange":"9:22-35","startChapter":9,"startVerse":22,"endChapter":9,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 10:1-20', 'exo-p22', 20, 2022, '{"id":"exo-p22","sequence":22,"verseRange":"10:1-20","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 10:21-29', 'exo-p23', 9, 2023, '{"id":"exo-p23","sequence":23,"verseRange":"10:21-29","startChapter":10,"startVerse":21,"endChapter":10,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 11:1-10', 'exo-p24', 10, 2024, '{"id":"exo-p24","sequence":24,"verseRange":"11:1-10","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 12:1-13', 'exo-p25', 13, 2025, '{"id":"exo-p25","sequence":25,"verseRange":"12:1-13","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 12:14-28', 'exo-p26', 15, 2026, '{"id":"exo-p26","sequence":26,"verseRange":"12:14-28","startChapter":12,"startVerse":14,"endChapter":12,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 12:29-42', 'exo-p27', 14, 2027, '{"id":"exo-p27","sequence":27,"verseRange":"12:29-42","startChapter":12,"startVerse":29,"endChapter":12,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 12:43-51', 'exo-p28', 9, 2028, '{"id":"exo-p28","sequence":28,"verseRange":"12:43-51","startChapter":12,"startVerse":43,"endChapter":12,"endVerse":51}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 13:1-16', 'exo-p29', 16, 2029, '{"id":"exo-p29","sequence":29,"verseRange":"13:1-16","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 13:17-22', 'exo-p30', 6, 2030, '{"id":"exo-p30","sequence":30,"verseRange":"13:17-22","startChapter":13,"startVerse":17,"endChapter":13,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 14:1-14', 'exo-p31', 14, 2031, '{"id":"exo-p31","sequence":31,"verseRange":"14:1-14","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 14:15-31', 'exo-p32', 17, 2032, '{"id":"exo-p32","sequence":32,"verseRange":"14:15-31","startChapter":14,"startVerse":15,"endChapter":14,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 15:1-10', 'exo-p33a', 10, 2033, '{"id":"exo-p33a","sequence":33,"verseRange":"15:1-10","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 15:11-18', 'exo-p33b', 8, 2033, '{"id":"exo-p33b","sequence":33,"verseRange":"15:11-18","startChapter":15,"startVerse":11,"endChapter":15,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 15:19-27', 'exo-p34', 9, 2034, '{"id":"exo-p34","sequence":34,"verseRange":"15:19-27","startChapter":15,"startVerse":19,"endChapter":15,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 16:1-12', 'exo-p35', 12, 2035, '{"id":"exo-p35","sequence":35,"verseRange":"16:1-12","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 16:13-21', 'exo-p36', 9, 2036, '{"id":"exo-p36","sequence":36,"verseRange":"16:13-21","startChapter":16,"startVerse":13,"endChapter":16,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 16:22-36', 'exo-p37', 15, 2037, '{"id":"exo-p37","sequence":37,"verseRange":"16:22-36","startChapter":16,"startVerse":22,"endChapter":16,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 17:1-7', 'exo-p38', 7, 2038, '{"id":"exo-p38","sequence":38,"verseRange":"17:1-7","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 17:8-16', 'exo-p39', 9, 2039, '{"id":"exo-p39","sequence":39,"verseRange":"17:8-16","startChapter":17,"startVerse":8,"endChapter":17,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 18:1-12', 'exo-p40', 12, 2040, '{"id":"exo-p40","sequence":40,"verseRange":"18:1-12","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 18:13-27', 'exo-p41', 15, 2041, '{"id":"exo-p41","sequence":41,"verseRange":"18:13-27","startChapter":18,"startVerse":13,"endChapter":18,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 19:1-15', 'exo-p42', 15, 2042, '{"id":"exo-p42","sequence":42,"verseRange":"19:1-15","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 19:16-25', 'exo-p43', 10, 2043, '{"id":"exo-p43","sequence":43,"verseRange":"19:16-25","startChapter":19,"startVerse":16,"endChapter":19,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 20:1-7', 'exo-p44', 7, 2044, '{"id":"exo-p44","sequence":44,"verseRange":"20:1-7","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 20:8-17', 'exo-p45', 10, 2045, '{"id":"exo-p45","sequence":45,"verseRange":"20:8-17","startChapter":20,"startVerse":8,"endChapter":20,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 20:18-26', 'exo-p46', 9, 2046, '{"id":"exo-p46","sequence":46,"verseRange":"20:18-26","startChapter":20,"startVerse":18,"endChapter":20,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 21:1-11', 'exo-p47', 11, 2047, '{"id":"exo-p47","sequence":47,"verseRange":"21:1-11","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 21:12-17', 'exo-p48', 6, 2048, '{"id":"exo-p48","sequence":48,"verseRange":"21:12-17","startChapter":21,"startVerse":12,"endChapter":21,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 21:18-27', 'exo-p49', 10, 2049, '{"id":"exo-p49","sequence":49,"verseRange":"21:18-27","startChapter":21,"startVerse":18,"endChapter":21,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 21:28-36', 'exo-p50', 9, 2050, '{"id":"exo-p50","sequence":50,"verseRange":"21:28-36","startChapter":21,"startVerse":28,"endChapter":21,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 22:1-6', 'exo-p51a', 6, 2051, '{"id":"exo-p51a","sequence":51,"verseRange":"22:1-6","startChapter":22,"startVerse":1,"endChapter":22,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 22:7-15', 'exo-p51b', 9, 2051, '{"id":"exo-p51b","sequence":51,"verseRange":"22:7-15","startChapter":22,"startVerse":7,"endChapter":22,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 22:16-24', 'exo-p52', 9, 2052, '{"id":"exo-p52","sequence":52,"verseRange":"22:16-24","startChapter":22,"startVerse":16,"endChapter":22,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 22:25-31', 'exo-p53', 7, 2053, '{"id":"exo-p53","sequence":53,"verseRange":"22:25-31","startChapter":22,"startVerse":25,"endChapter":22,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 23:1-9', 'exo-p54', 9, 2054, '{"id":"exo-p54","sequence":54,"verseRange":"23:1-9","startChapter":23,"startVerse":1,"endChapter":23,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 23:10-19', 'exo-p55', 10, 2055, '{"id":"exo-p55","sequence":55,"verseRange":"23:10-19","startChapter":23,"startVerse":10,"endChapter":23,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 23:20-33', 'exo-p56', 14, 2056, '{"id":"exo-p56","sequence":56,"verseRange":"23:20-33","startChapter":23,"startVerse":20,"endChapter":23,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 24:1-8', 'exo-p57', 8, 2057, '{"id":"exo-p57","sequence":57,"verseRange":"24:1-8","startChapter":24,"startVerse":1,"endChapter":24,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 24:9-18', 'exo-p58', 10, 2058, '{"id":"exo-p58","sequence":58,"verseRange":"24:9-18","startChapter":24,"startVerse":9,"endChapter":24,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 25:1-9', 'exo-p59', 9, 2059, '{"id":"exo-p59","sequence":59,"verseRange":"25:1-9","startChapter":25,"startVerse":1,"endChapter":25,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 25:10-22', 'exo-p60', 13, 2060, '{"id":"exo-p60","sequence":60,"verseRange":"25:10-22","startChapter":25,"startVerse":10,"endChapter":25,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 25:23-30', 'exo-p61', 8, 2061, '{"id":"exo-p61","sequence":61,"verseRange":"25:23-30","startChapter":25,"startVerse":23,"endChapter":25,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 25:31-40', 'exo-p62', 10, 2062, '{"id":"exo-p62","sequence":62,"verseRange":"25:31-40","startChapter":25,"startVerse":31,"endChapter":25,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 26:1-14', 'exo-p63', 14, 2063, '{"id":"exo-p63","sequence":63,"verseRange":"26:1-14","startChapter":26,"startVerse":1,"endChapter":26,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 26:15-30', 'exo-p64', 16, 2064, '{"id":"exo-p64","sequence":64,"verseRange":"26:15-30","startChapter":26,"startVerse":15,"endChapter":26,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 26:31-37', 'exo-p65', 7, 2065, '{"id":"exo-p65","sequence":65,"verseRange":"26:31-37","startChapter":26,"startVerse":31,"endChapter":26,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 27:1-8', 'exo-p66', 8, 2066, '{"id":"exo-p66","sequence":66,"verseRange":"27:1-8","startChapter":27,"startVerse":1,"endChapter":27,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 27:9-21', 'exo-p67', 13, 2067, '{"id":"exo-p67","sequence":67,"verseRange":"27:9-21","startChapter":27,"startVerse":9,"endChapter":27,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 28:1-14', 'exo-p68', 14, 2068, '{"id":"exo-p68","sequence":68,"verseRange":"28:1-14","startChapter":28,"startVerse":1,"endChapter":28,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 28:15-30', 'exo-p69', 16, 2069, '{"id":"exo-p69","sequence":69,"verseRange":"28:15-30","startChapter":28,"startVerse":15,"endChapter":28,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 28:31-43', 'exo-p70', 13, 2070, '{"id":"exo-p70","sequence":70,"verseRange":"28:31-43","startChapter":28,"startVerse":31,"endChapter":28,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 29:1-9', 'exo-p71', 9, 2071, '{"id":"exo-p71","sequence":71,"verseRange":"29:1-9","startChapter":29,"startVerse":1,"endChapter":29,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 29:10-18', 'exo-p72', 9, 2072, '{"id":"exo-p72","sequence":72,"verseRange":"29:10-18","startChapter":29,"startVerse":10,"endChapter":29,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 29:19-28', 'exo-p73', 10, 2073, '{"id":"exo-p73","sequence":73,"verseRange":"29:19-28","startChapter":29,"startVerse":19,"endChapter":29,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 29:29-37', 'exo-p74', 9, 2074, '{"id":"exo-p74","sequence":74,"verseRange":"29:29-37","startChapter":29,"startVerse":29,"endChapter":29,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 29:38-46', 'exo-p75', 9, 2075, '{"id":"exo-p75","sequence":75,"verseRange":"29:38-46","startChapter":29,"startVerse":38,"endChapter":29,"endVerse":46}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 30:1-10', 'exo-p76', 10, 2076, '{"id":"exo-p76","sequence":76,"verseRange":"30:1-10","startChapter":30,"startVerse":1,"endChapter":30,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 30:11-16', 'exo-p77', 6, 2077, '{"id":"exo-p77","sequence":77,"verseRange":"30:11-16","startChapter":30,"startVerse":11,"endChapter":30,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 30:17-21', 'exo-p78', 5, 2078, '{"id":"exo-p78","sequence":78,"verseRange":"30:17-21","startChapter":30,"startVerse":17,"endChapter":30,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 30:22-33', 'exo-p79', 12, 2079, '{"id":"exo-p79","sequence":79,"verseRange":"30:22-33","startChapter":30,"startVerse":22,"endChapter":30,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 30:34-38', 'exo-p80', 5, 2080, '{"id":"exo-p80","sequence":80,"verseRange":"30:34-38","startChapter":30,"startVerse":34,"endChapter":30,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 31:1-11', 'exo-p81', 11, 2081, '{"id":"exo-p81","sequence":81,"verseRange":"31:1-11","startChapter":31,"startVerse":1,"endChapter":31,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 31:12-18', 'exo-p82', 7, 2082, '{"id":"exo-p82","sequence":82,"verseRange":"31:12-18","startChapter":31,"startVerse":12,"endChapter":31,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 32:1-14', 'exo-p83', 14, 2083, '{"id":"exo-p83","sequence":83,"verseRange":"32:1-14","startChapter":32,"startVerse":1,"endChapter":32,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 32:15-24', 'exo-p84', 10, 2084, '{"id":"exo-p84","sequence":84,"verseRange":"32:15-24","startChapter":32,"startVerse":15,"endChapter":32,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 32:25-35', 'exo-p85', 11, 2085, '{"id":"exo-p85","sequence":85,"verseRange":"32:25-35","startChapter":32,"startVerse":25,"endChapter":32,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 33:1-11', 'exo-p86', 11, 2086, '{"id":"exo-p86","sequence":86,"verseRange":"33:1-11","startChapter":33,"startVerse":1,"endChapter":33,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 33:12-23', 'exo-p87', 12, 2087, '{"id":"exo-p87","sequence":87,"verseRange":"33:12-23","startChapter":33,"startVerse":12,"endChapter":33,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 34:1-9', 'exo-p88', 9, 2088, '{"id":"exo-p88","sequence":88,"verseRange":"34:1-9","startChapter":34,"startVerse":1,"endChapter":34,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 34:10-17', 'exo-p89', 8, 2089, '{"id":"exo-p89","sequence":89,"verseRange":"34:10-17","startChapter":34,"startVerse":10,"endChapter":34,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 34:18-28', 'exo-p90', 11, 2090, '{"id":"exo-p90","sequence":90,"verseRange":"34:18-28","startChapter":34,"startVerse":18,"endChapter":34,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 34:29-35', 'exo-p91', 7, 2091, '{"id":"exo-p91","sequence":91,"verseRange":"34:29-35","startChapter":34,"startVerse":29,"endChapter":34,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 35:1-19', 'exo-p92', 19, 2092, '{"id":"exo-p92","sequence":92,"verseRange":"35:1-19","startChapter":35,"startVerse":1,"endChapter":35,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 35:20-29', 'exo-p93', 10, 2093, '{"id":"exo-p93","sequence":93,"verseRange":"35:20-29","startChapter":35,"startVerse":20,"endChapter":35,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 35:30-36:7', 'exo-p94', 13, 2094, '{"id":"exo-p94","sequence":94,"verseRange":"35:30-36:7","startChapter":35,"startVerse":30,"endChapter":36,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 36:8-19', 'exo-p95', 12, 2095, '{"id":"exo-p95","sequence":95,"verseRange":"36:8-19","startChapter":36,"startVerse":8,"endChapter":36,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 36:20-34', 'exo-p96', 15, 2096, '{"id":"exo-p96","sequence":96,"verseRange":"36:20-34","startChapter":36,"startVerse":20,"endChapter":36,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 36:35-38', 'exo-p97', 4, 2097, '{"id":"exo-p97","sequence":97,"verseRange":"36:35-38","startChapter":36,"startVerse":35,"endChapter":36,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 37:1-9', 'exo-p98', 9, 2098, '{"id":"exo-p98","sequence":98,"verseRange":"37:1-9","startChapter":37,"startVerse":1,"endChapter":37,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 37:10-16', 'exo-p99', 7, 2099, '{"id":"exo-p99","sequence":99,"verseRange":"37:10-16","startChapter":37,"startVerse":10,"endChapter":37,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 37:17-24', 'exo-p100', 8, 2100, '{"id":"exo-p100","sequence":100,"verseRange":"37:17-24","startChapter":37,"startVerse":17,"endChapter":37,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 37:25-38:8', 'exo-p101', 13, 2101, '{"id":"exo-p101","sequence":101,"verseRange":"37:25-38:8","startChapter":37,"startVerse":25,"endChapter":38,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 38:9-20', 'exo-p102', 12, 2102, '{"id":"exo-p102","sequence":102,"verseRange":"38:9-20","startChapter":38,"startVerse":9,"endChapter":38,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 38:21-31', 'exo-p103', 11, 2103, '{"id":"exo-p103","sequence":103,"verseRange":"38:21-31","startChapter":38,"startVerse":21,"endChapter":38,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 39:1-7', 'exo-p104', 7, 2104, '{"id":"exo-p104","sequence":104,"verseRange":"39:1-7","startChapter":39,"startVerse":1,"endChapter":39,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 39:8-21', 'exo-p105', 14, 2105, '{"id":"exo-p105","sequence":105,"verseRange":"39:8-21","startChapter":39,"startVerse":8,"endChapter":39,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 39:22-31', 'exo-p106', 10, 2106, '{"id":"exo-p106","sequence":106,"verseRange":"39:22-31","startChapter":39,"startVerse":22,"endChapter":39,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 39:32-43', 'exo-p107', 12, 2107, '{"id":"exo-p107","sequence":107,"verseRange":"39:32-43","startChapter":39,"startVerse":32,"endChapter":39,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 40:1-15', 'exo-p108', 15, 2108, '{"id":"exo-p108","sequence":108,"verseRange":"40:1-15","startChapter":40,"startVerse":1,"endChapter":40,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 40:16-33', 'exo-p109', 18, 2109, '{"id":"exo-p109","sequence":109,"verseRange":"40:16-33","startChapter":40,"startVerse":16,"endChapter":40,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Exodus 40:34-38', 'exo-p110', 5, 2110, '{"id":"exo-p110","sequence":110,"verseRange":"40:34-38","startChapter":40,"startVerse":34,"endChapter":40,"endVerse":38}'::jsonb);

-- Leviticus
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Leviticus', 'lev', 0, 3000, NULL
);

-- Numbers
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Numbers', 'num', 114, 4000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 1:1-16', 'num-p1', 16, 4001, '{"id":"num-p1","sequence":1,"verseRange":"1:1-16","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 1:17-47', 'num-p2', 31, 4002, '{"id":"num-p2","sequence":2,"verseRange":"1:17-47","startChapter":1,"startVerse":17,"endChapter":1,"endVerse":47}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 1:48-54', 'num-p3', 7, 4003, '{"id":"num-p3","sequence":3,"verseRange":"1:48-54","startChapter":1,"startVerse":48,"endChapter":1,"endVerse":54}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 2:1-17', 'num-p4', 17, 4004, '{"id":"num-p4","sequence":4,"verseRange":"2:1-17","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 2:18-34', 'num-p5', 17, 4005, '{"id":"num-p5","sequence":5,"verseRange":"2:18-34","startChapter":2,"startVerse":18,"endChapter":2,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 3:1-13', 'num-p6', 13, 4006, '{"id":"num-p6","sequence":6,"verseRange":"3:1-13","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 3:14-20', 'num-p7', 7, 4007, '{"id":"num-p7","sequence":7,"verseRange":"3:14-20","startChapter":3,"startVerse":14,"endChapter":3,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 3:21-26', 'num-p8', 6, 4008, '{"id":"num-p8","sequence":8,"verseRange":"3:21-26","startChapter":3,"startVerse":21,"endChapter":3,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 3:27-32', 'num-p9', 6, 4009, '{"id":"num-p9","sequence":9,"verseRange":"3:27-32","startChapter":3,"startVerse":27,"endChapter":3,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 3:33-39', 'num-p10', 7, 4010, '{"id":"num-p10","sequence":10,"verseRange":"3:33-39","startChapter":3,"startVerse":33,"endChapter":3,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 3:40-51', 'num-p11', 12, 4011, '{"id":"num-p11","sequence":11,"verseRange":"3:40-51","startChapter":3,"startVerse":40,"endChapter":3,"endVerse":51}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 4:1-20', 'num-p12', 20, 4012, '{"id":"num-p12","sequence":12,"verseRange":"4:1-20","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 4:21-28', 'num-p13', 8, 4013, '{"id":"num-p13","sequence":13,"verseRange":"4:21-28","startChapter":4,"startVerse":21,"endChapter":4,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 4:29-33', 'num-p14', 5, 4014, '{"id":"num-p14","sequence":14,"verseRange":"4:29-33","startChapter":4,"startVerse":29,"endChapter":4,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 4:34-49', 'num-p15', 16, 4015, '{"id":"num-p15","sequence":15,"verseRange":"4:34-49","startChapter":4,"startVerse":34,"endChapter":4,"endVerse":49}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 5:1-4', 'num-p16', 4, 4016, '{"id":"num-p16","sequence":16,"verseRange":"5:1-4","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 5:5-10', 'num-p17', 6, 4017, '{"id":"num-p17","sequence":17,"verseRange":"5:5-10","startChapter":5,"startVerse":5,"endChapter":5,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 5:11-31', 'num-p18', 21, 4018, '{"id":"num-p18","sequence":18,"verseRange":"5:11-31","startChapter":5,"startVerse":11,"endChapter":5,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 6:1-12', 'num-p19a', 12, 4019, '{"id":"num-p19a","sequence":19,"verseRange":"6:1-12","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 6:13-21', 'num-p19b', 9, 4019, '{"id":"num-p19b","sequence":19,"verseRange":"6:13-21","startChapter":6,"startVerse":13,"endChapter":6,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 6:22-27', 'num-p20', 6, 4020, '{"id":"num-p20","sequence":20,"verseRange":"6:22-27","startChapter":6,"startVerse":22,"endChapter":6,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 7:1-9', 'num-p21', 9, 4021, '{"id":"num-p21","sequence":21,"verseRange":"7:1-9","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 7:10-83', 'num-p22', 74, 4022, '{"id":"num-p22","sequence":22,"verseRange":"7:10-83","startChapter":7,"startVerse":10,"endChapter":7,"endVerse":83}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 7:84-89', 'num-p23', 6, 4023, '{"id":"num-p23","sequence":23,"verseRange":"7:84-89","startChapter":7,"startVerse":84,"endChapter":7,"endVerse":89}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 8:1-4', 'num-p24', 4, 4024, '{"id":"num-p24","sequence":24,"verseRange":"8:1-4","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 8:5-22', 'num-p25', 18, 4025, '{"id":"num-p25","sequence":25,"verseRange":"8:5-22","startChapter":8,"startVerse":5,"endChapter":8,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 8:23-26', 'num-p26', 4, 4026, '{"id":"num-p26","sequence":26,"verseRange":"8:23-26","startChapter":8,"startVerse":23,"endChapter":8,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 9:1-14', 'num-p27', 14, 4027, '{"id":"num-p27","sequence":27,"verseRange":"9:1-14","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 9:15-23', 'num-p28', 9, 4028, '{"id":"num-p28","sequence":28,"verseRange":"9:15-23","startChapter":9,"startVerse":15,"endChapter":9,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 10:1-10', 'num-p29', 10, 4029, '{"id":"num-p29","sequence":29,"verseRange":"10:1-10","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 10:11-36', 'num-p30', 26, 4030, '{"id":"num-p30","sequence":30,"verseRange":"10:11-36","startChapter":10,"startVerse":11,"endChapter":10,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 11:1-15', 'num-p31', 15, 4031, '{"id":"num-p31","sequence":31,"verseRange":"11:1-15","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 11:16-30', 'num-p32', 15, 4032, '{"id":"num-p32","sequence":32,"verseRange":"11:16-30","startChapter":11,"startVerse":16,"endChapter":11,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 11:31-35', 'num-p33', 5, 4033, '{"id":"num-p33","sequence":33,"verseRange":"11:31-35","startChapter":11,"startVerse":31,"endChapter":11,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 12:1-16', 'num-p34', 16, 4034, '{"id":"num-p34","sequence":34,"verseRange":"12:1-16","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 13:1-16', 'num-p35', 16, 4035, '{"id":"num-p35","sequence":35,"verseRange":"13:1-16","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 13:17-33', 'num-p36', 17, 4036, '{"id":"num-p36","sequence":36,"verseRange":"13:17-33","startChapter":13,"startVerse":17,"endChapter":13,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 14:1-10', 'num-p37', 10, 4037, '{"id":"num-p37","sequence":37,"verseRange":"14:1-10","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 14:11-25', 'num-p38', 15, 4038, '{"id":"num-p38","sequence":38,"verseRange":"14:11-25","startChapter":14,"startVerse":11,"endChapter":14,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 14:26-38', 'num-p39', 13, 4039, '{"id":"num-p39","sequence":39,"verseRange":"14:26-38","startChapter":14,"startVerse":26,"endChapter":14,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 14:39-45', 'num-p40', 7, 4040, '{"id":"num-p40","sequence":40,"verseRange":"14:39-45","startChapter":14,"startVerse":39,"endChapter":14,"endVerse":45}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 15:1-16', 'num-p41', 16, 4041, '{"id":"num-p41","sequence":41,"verseRange":"15:1-16","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 15:17-21', 'num-p42', 5, 4042, '{"id":"num-p42","sequence":42,"verseRange":"15:17-21","startChapter":15,"startVerse":17,"endChapter":15,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 15:22-31', 'num-p43', 10, 4043, '{"id":"num-p43","sequence":43,"verseRange":"15:22-31","startChapter":15,"startVerse":22,"endChapter":15,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 15:32-36', 'num-p44', 5, 4044, '{"id":"num-p44","sequence":44,"verseRange":"15:32-36","startChapter":15,"startVerse":32,"endChapter":15,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 15:37-41', 'num-p45', 5, 4045, '{"id":"num-p45","sequence":45,"verseRange":"15:37-41","startChapter":15,"startVerse":37,"endChapter":15,"endVerse":41}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 16:1-19', 'num-p46a', 19, 4046, '{"id":"num-p46a","sequence":46,"verseRange":"16:1-19","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 16:20-35', 'num-p46b', 16, 4046, '{"id":"num-p46b","sequence":46,"verseRange":"16:20-35","startChapter":16,"startVerse":20,"endChapter":16,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 16:36-50', 'num-p47', 15, 4047, '{"id":"num-p47","sequence":47,"verseRange":"16:36-50","startChapter":16,"startVerse":36,"endChapter":16,"endVerse":50}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 17:1-13', 'num-p48', 13, 4048, '{"id":"num-p48","sequence":48,"verseRange":"17:1-13","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 18:1-7', 'num-p49', 7, 4049, '{"id":"num-p49","sequence":49,"verseRange":"18:1-7","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 18:8-20', 'num-p50', 13, 4050, '{"id":"num-p50","sequence":50,"verseRange":"18:8-20","startChapter":18,"startVerse":8,"endChapter":18,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 18:21-24', 'num-p51', 4, 4051, '{"id":"num-p51","sequence":51,"verseRange":"18:21-24","startChapter":18,"startVerse":21,"endChapter":18,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 18:25-32', 'num-p52', 8, 4052, '{"id":"num-p52","sequence":52,"verseRange":"18:25-32","startChapter":18,"startVerse":25,"endChapter":18,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 19:1-10', 'num-p53', 10, 4053, '{"id":"num-p53","sequence":53,"verseRange":"19:1-10","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 19:11-22', 'num-p54', 12, 4054, '{"id":"num-p54","sequence":54,"verseRange":"19:11-22","startChapter":19,"startVerse":11,"endChapter":19,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 20:1-13', 'num-p55', 13, 4055, '{"id":"num-p55","sequence":55,"verseRange":"20:1-13","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 20:14-21', 'num-p56', 8, 4056, '{"id":"num-p56","sequence":56,"verseRange":"20:14-21","startChapter":20,"startVerse":14,"endChapter":20,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 20:22-29', 'num-p57', 8, 4057, '{"id":"num-p57","sequence":57,"verseRange":"20:22-29","startChapter":20,"startVerse":22,"endChapter":20,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 21:1-9', 'num-p58', 9, 4058, '{"id":"num-p58","sequence":58,"verseRange":"21:1-9","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 21:10-20', 'num-p59', 11, 4059, '{"id":"num-p59","sequence":59,"verseRange":"21:10-20","startChapter":21,"startVerse":10,"endChapter":21,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 21:21-26', 'num-p60a', 6, 4060, '{"id":"num-p60a","sequence":60,"verseRange":"21:21-26","startChapter":21,"startVerse":21,"endChapter":21,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 21:27-30', 'num-p60b', 4, 4060, '{"id":"num-p60b","sequence":60,"verseRange":"21:27-30","startChapter":21,"startVerse":27,"endChapter":21,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 21:31-35', 'num-p61', 5, 4061, '{"id":"num-p61","sequence":61,"verseRange":"21:31-35","startChapter":21,"startVerse":31,"endChapter":21,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 22:1-21', 'num-p62', 21, 4062, '{"id":"num-p62","sequence":62,"verseRange":"22:1-21","startChapter":22,"startVerse":1,"endChapter":22,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 22:22-40', 'num-p63', 19, 4063, '{"id":"num-p63","sequence":63,"verseRange":"22:22-40","startChapter":22,"startVerse":22,"endChapter":22,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 22:41-23:6', 'num-p64', 7, 4064, '{"id":"num-p64","sequence":64,"verseRange":"22:41-23:6","startChapter":22,"startVerse":41,"endChapter":23,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 23:7-12', 'num-p65', 6, 4065, '{"id":"num-p65","sequence":65,"verseRange":"23:7-12","startChapter":23,"startVerse":7,"endChapter":23,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 23:13-26', 'num-p66', 14, 4066, '{"id":"num-p66","sequence":66,"verseRange":"23:13-26","startChapter":23,"startVerse":13,"endChapter":23,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 23:27-24:13', 'num-p67', 17, 4067, '{"id":"num-p67","sequence":67,"verseRange":"23:27-24:13","startChapter":23,"startVerse":27,"endChapter":24,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 24:14-19', 'num-p68', 6, 4068, '{"id":"num-p68","sequence":68,"verseRange":"24:14-19","startChapter":24,"startVerse":14,"endChapter":24,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 24:20-25', 'num-p69', 6, 4069, '{"id":"num-p69","sequence":69,"verseRange":"24:20-25","startChapter":24,"startVerse":20,"endChapter":24,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 25:1-9', 'num-p70', 9, 4070, '{"id":"num-p70","sequence":70,"verseRange":"25:1-9","startChapter":25,"startVerse":1,"endChapter":25,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 25:10-18', 'num-p71', 9, 4071, '{"id":"num-p71","sequence":71,"verseRange":"25:10-18","startChapter":25,"startVerse":10,"endChapter":25,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:1-11', 'num-p72a', 11, 4072, '{"id":"num-p72a","sequence":72,"verseRange":"26:1-11","startChapter":26,"startVerse":1,"endChapter":26,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:12-14', 'num-p72b', 3, 4072, '{"id":"num-p72b","sequence":72,"verseRange":"26:12-14","startChapter":26,"startVerse":12,"endChapter":26,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:15-18', 'num-p72c', 4, 4072, '{"id":"num-p72c","sequence":72,"verseRange":"26:15-18","startChapter":26,"startVerse":15,"endChapter":26,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:19-22', 'num-p72d', 4, 4072, '{"id":"num-p72d","sequence":72,"verseRange":"26:19-22","startChapter":26,"startVerse":19,"endChapter":26,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:23-25', 'num-p72e', 3, 4072, '{"id":"num-p72e","sequence":72,"verseRange":"26:23-25","startChapter":26,"startVerse":23,"endChapter":26,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:26-27', 'num-p72f', 2, 4072, '{"id":"num-p72f","sequence":72,"verseRange":"26:26-27","startChapter":26,"startVerse":26,"endChapter":26,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:28-34', 'num-p72g', 7, 4072, '{"id":"num-p72g","sequence":72,"verseRange":"26:28-34","startChapter":26,"startVerse":28,"endChapter":26,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:35-37', 'num-p72h', 3, 4072, '{"id":"num-p72h","sequence":72,"verseRange":"26:35-37","startChapter":26,"startVerse":35,"endChapter":26,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:38-41', 'num-p72i', 4, 4072, '{"id":"num-p72i","sequence":72,"verseRange":"26:38-41","startChapter":26,"startVerse":38,"endChapter":26,"endVerse":41}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:42-43', 'num-p72j', 2, 4072, '{"id":"num-p72j","sequence":72,"verseRange":"26:42-43","startChapter":26,"startVerse":42,"endChapter":26,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:44-47', 'num-p72k', 4, 4072, '{"id":"num-p72k","sequence":72,"verseRange":"26:44-47","startChapter":26,"startVerse":44,"endChapter":26,"endVerse":47}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:48-50', 'num-p72l', 3, 4072, '{"id":"num-p72l","sequence":72,"verseRange":"26:48-50","startChapter":26,"startVerse":48,"endChapter":26,"endVerse":50}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:51-56', 'num-p72m', 6, 4072, '{"id":"num-p72m","sequence":72,"verseRange":"26:51-56","startChapter":26,"startVerse":51,"endChapter":26,"endVerse":56}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 26:57-65', 'num-p72n', 9, 4072, '{"id":"num-p72n","sequence":72,"verseRange":"26:57-65","startChapter":26,"startVerse":57,"endChapter":26,"endVerse":65}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 27:1-11', 'num-p73', 11, 4073, '{"id":"num-p73","sequence":73,"verseRange":"27:1-11","startChapter":27,"startVerse":1,"endChapter":27,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 27:12-23', 'num-p74', 12, 4074, '{"id":"num-p74","sequence":74,"verseRange":"27:12-23","startChapter":27,"startVerse":12,"endChapter":27,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 28:1-10', 'num-p75', 10, 4075, '{"id":"num-p75","sequence":75,"verseRange":"28:1-10","startChapter":28,"startVerse":1,"endChapter":28,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 28:11-15', 'num-p76', 5, 4076, '{"id":"num-p76","sequence":76,"verseRange":"28:11-15","startChapter":28,"startVerse":11,"endChapter":28,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 28:16-25', 'num-p77', 10, 4077, '{"id":"num-p77","sequence":77,"verseRange":"28:16-25","startChapter":28,"startVerse":16,"endChapter":28,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 28:26-31', 'num-p78', 6, 4078, '{"id":"num-p78","sequence":78,"verseRange":"28:26-31","startChapter":28,"startVerse":26,"endChapter":28,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 29:1-6', 'num-p79', 6, 4079, '{"id":"num-p79","sequence":79,"verseRange":"29:1-6","startChapter":29,"startVerse":1,"endChapter":29,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 29:7-11', 'num-p80', 5, 4080, '{"id":"num-p80","sequence":80,"verseRange":"29:7-11","startChapter":29,"startVerse":7,"endChapter":29,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 29:12-40', 'num-p81', 29, 4081, '{"id":"num-p81","sequence":81,"verseRange":"29:12-40","startChapter":29,"startVerse":12,"endChapter":29,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 30:1-16', 'num-p82', 16, 4082, '{"id":"num-p82","sequence":82,"verseRange":"30:1-16","startChapter":30,"startVerse":1,"endChapter":30,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 31:1-24', 'num-p83', 24, 4083, '{"id":"num-p83","sequence":83,"verseRange":"31:1-24","startChapter":31,"startVerse":1,"endChapter":31,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 31:25-54', 'num-p84', 30, 4084, '{"id":"num-p84","sequence":84,"verseRange":"31:25-54","startChapter":31,"startVerse":25,"endChapter":31,"endVerse":54}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 32:1-15', 'num-p85', 15, 4085, '{"id":"num-p85","sequence":85,"verseRange":"32:1-15","startChapter":32,"startVerse":1,"endChapter":32,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 32:16-27', 'num-p86', 12, 4086, '{"id":"num-p86","sequence":86,"verseRange":"32:16-27","startChapter":32,"startVerse":16,"endChapter":32,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 32:28-32', 'num-p87', 5, 4087, '{"id":"num-p87","sequence":87,"verseRange":"32:28-32","startChapter":32,"startVerse":28,"endChapter":32,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 32:33-42', 'num-p88', 10, 4088, '{"id":"num-p88","sequence":88,"verseRange":"32:33-42","startChapter":32,"startVerse":33,"endChapter":32,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 33:1-15', 'num-p89a', 15, 4089, '{"id":"num-p89a","sequence":89,"verseRange":"33:1-15","startChapter":33,"startVerse":1,"endChapter":33,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 33:16-36', 'num-p89b', 21, 4089, '{"id":"num-p89b","sequence":89,"verseRange":"33:16-36","startChapter":33,"startVerse":16,"endChapter":33,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 33:37-49', 'num-p89c', 13, 4089, '{"id":"num-p89c","sequence":89,"verseRange":"33:37-49","startChapter":33,"startVerse":37,"endChapter":33,"endVerse":49}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 33:50-56', 'num-p90', 7, 4090, '{"id":"num-p90","sequence":90,"verseRange":"33:50-56","startChapter":33,"startVerse":50,"endChapter":33,"endVerse":56}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 34:1-15', 'num-p91', 15, 4091, '{"id":"num-p91","sequence":91,"verseRange":"34:1-15","startChapter":34,"startVerse":1,"endChapter":34,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 34:16-29', 'num-p92', 14, 4092, '{"id":"num-p92","sequence":92,"verseRange":"34:16-29","startChapter":34,"startVerse":16,"endChapter":34,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 35:1-8', 'num-p93', 8, 4093, '{"id":"num-p93","sequence":93,"verseRange":"35:1-8","startChapter":35,"startVerse":1,"endChapter":35,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 35:9-29', 'num-p94a', 21, 4094, '{"id":"num-p94a","sequence":94,"verseRange":"35:9-29","startChapter":35,"startVerse":9,"endChapter":35,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 35:30-34', 'num-p94b', 5, 4094, '{"id":"num-p94b","sequence":94,"verseRange":"35:30-34","startChapter":35,"startVerse":30,"endChapter":35,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Numbers 36:1-13', 'num-p95', 13, 4095, '{"id":"num-p95","sequence":95,"verseRange":"36:1-13","startChapter":36,"startVerse":1,"endChapter":36,"endVerse":13}'::jsonb);

-- Deuteronomy
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Deuteronomy', 'deu', 0, 5000, NULL
);

-- Joshua
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Joshua', 'jos', 62, 6000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 1:1-9', 'jos-p1', 9, 6001, '{"id":"jos-p1","sequence":1,"verseRange":"1:1-9","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 1:10-18', 'jos-p2', 9, 6002, '{"id":"jos-p2","sequence":2,"verseRange":"1:10-18","startChapter":1,"startVerse":10,"endChapter":1,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 2:1-14', 'jos-p3', 14, 6003, '{"id":"jos-p3","sequence":3,"verseRange":"2:1-14","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 2:15-24', 'jos-p4', 10, 6004, '{"id":"jos-p4","sequence":4,"verseRange":"2:15-24","startChapter":2,"startVerse":15,"endChapter":2,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 3:1-17', 'jos-p5', 17, 6005, '{"id":"jos-p5","sequence":5,"verseRange":"3:1-17","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 4:1-14', 'jos-p6', 14, 6006, '{"id":"jos-p6","sequence":6,"verseRange":"4:1-14","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 4:15-5:1', 'jos-p7', 11, 6007, '{"id":"jos-p7","sequence":7,"verseRange":"4:15-5:1","startChapter":4,"startVerse":15,"endChapter":5,"endVerse":1}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 5:2-9', 'jos-p8', 8, 6008, '{"id":"jos-p8","sequence":8,"verseRange":"5:2-9","startChapter":5,"startVerse":2,"endChapter":5,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 5:10-15', 'jos-p9', 6, 6009, '{"id":"jos-p9","sequence":9,"verseRange":"5:10-15","startChapter":5,"startVerse":10,"endChapter":5,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 6:1-14', 'jos-p10', 14, 6010, '{"id":"jos-p10","sequence":10,"verseRange":"6:1-14","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 6:15-27', 'jos-p11', 13, 6011, '{"id":"jos-p11","sequence":11,"verseRange":"6:15-27","startChapter":6,"startVerse":15,"endChapter":6,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 7:1-9', 'jos-p12', 9, 6012, '{"id":"jos-p12","sequence":12,"verseRange":"7:1-9","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 7:10-26', 'jos-p13', 17, 6013, '{"id":"jos-p13","sequence":13,"verseRange":"7:10-26","startChapter":7,"startVerse":10,"endChapter":7,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 8:1-13', 'jos-p14', 13, 6014, '{"id":"jos-p14","sequence":14,"verseRange":"8:1-13","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 8:14-29', 'jos-p15', 16, 6015, '{"id":"jos-p15","sequence":15,"verseRange":"8:14-29","startChapter":8,"startVerse":14,"endChapter":8,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 8:30-35', 'jos-p16', 6, 6016, '{"id":"jos-p16","sequence":16,"verseRange":"8:30-35","startChapter":8,"startVerse":30,"endChapter":8,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 9:1-15', 'jos-p17', 15, 6017, '{"id":"jos-p17","sequence":17,"verseRange":"9:1-15","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 9:16-27', 'jos-p18', 12, 6018, '{"id":"jos-p18","sequence":18,"verseRange":"9:16-27","startChapter":9,"startVerse":16,"endChapter":9,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 10:1-15', 'jos-p19', 15, 6019, '{"id":"jos-p19","sequence":19,"verseRange":"10:1-15","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 10:16-28', 'jos-p20', 13, 6020, '{"id":"jos-p20","sequence":20,"verseRange":"10:16-28","startChapter":10,"startVerse":16,"endChapter":10,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 10:29-43', 'jos-p21', 15, 6021, '{"id":"jos-p21","sequence":21,"verseRange":"10:29-43","startChapter":10,"startVerse":29,"endChapter":10,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 11:1-15', 'jos-p22', 15, 6022, '{"id":"jos-p22","sequence":22,"verseRange":"11:1-15","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 11:16-23', 'jos-p23', 8, 6023, '{"id":"jos-p23","sequence":23,"verseRange":"11:16-23","startChapter":11,"startVerse":16,"endChapter":11,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 12:1-6', 'jos-p24', 6, 6024, '{"id":"jos-p24","sequence":24,"verseRange":"12:1-6","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 12:7-24', 'jos-p25', 18, 6025, '{"id":"jos-p25","sequence":25,"verseRange":"12:7-24","startChapter":12,"startVerse":7,"endChapter":12,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 13:1-7', 'jos-p26', 7, 6026, '{"id":"jos-p26","sequence":26,"verseRange":"13:1-7","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 13:8-13', 'jos-p27', 6, 6027, '{"id":"jos-p27","sequence":27,"verseRange":"13:8-13","startChapter":13,"startVerse":8,"endChapter":13,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 13:14-23', 'jos-p28', 10, 6028, '{"id":"jos-p28","sequence":28,"verseRange":"13:14-23","startChapter":13,"startVerse":14,"endChapter":13,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 13:24-33', 'jos-p29', 10, 6029, '{"id":"jos-p29","sequence":29,"verseRange":"13:24-33","startChapter":13,"startVerse":24,"endChapter":13,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 14:1-15', 'jos-p30', 15, 6030, '{"id":"jos-p30","sequence":30,"verseRange":"14:1-15","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 15:1-12', 'jos-p31', 12, 6031, '{"id":"jos-p31","sequence":31,"verseRange":"15:1-12","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 15:13-19', 'jos-p32', 7, 6032, '{"id":"jos-p32","sequence":32,"verseRange":"15:13-19","startChapter":15,"startVerse":13,"endChapter":15,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 15:20-32', 'jos-p33', 13, 6033, '{"id":"jos-p33","sequence":33,"verseRange":"15:20-32","startChapter":15,"startVerse":20,"endChapter":15,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 15:33-47', 'jos-p34', 15, 6034, '{"id":"jos-p34","sequence":34,"verseRange":"15:33-47","startChapter":15,"startVerse":33,"endChapter":15,"endVerse":47}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 15:48-63', 'jos-p35', 16, 6035, '{"id":"jos-p35","sequence":35,"verseRange":"15:48-63","startChapter":15,"startVerse":48,"endChapter":15,"endVerse":63}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 16:1-10', 'jos-p36', 10, 6036, '{"id":"jos-p36","sequence":36,"verseRange":"16:1-10","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 17:1-13', 'jos-p37', 13, 6037, '{"id":"jos-p37","sequence":37,"verseRange":"17:1-13","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 17:14-18', 'jos-p38', 5, 6038, '{"id":"jos-p38","sequence":38,"verseRange":"17:14-18","startChapter":17,"startVerse":14,"endChapter":17,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 18:1-10', 'jos-p39', 10, 6039, '{"id":"jos-p39","sequence":39,"verseRange":"18:1-10","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 18:11-28', 'jos-p40', 18, 6040, '{"id":"jos-p40","sequence":40,"verseRange":"18:11-28","startChapter":18,"startVerse":11,"endChapter":18,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 19:1-9', 'jos-p41', 9, 6041, '{"id":"jos-p41","sequence":41,"verseRange":"19:1-9","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 19:10-16', 'jos-p42', 7, 6042, '{"id":"jos-p42","sequence":42,"verseRange":"19:10-16","startChapter":19,"startVerse":10,"endChapter":19,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 19:17-23', 'jos-p43', 7, 6043, '{"id":"jos-p43","sequence":43,"verseRange":"19:17-23","startChapter":19,"startVerse":17,"endChapter":19,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 19:24-31', 'jos-p44', 8, 6044, '{"id":"jos-p44","sequence":44,"verseRange":"19:24-31","startChapter":19,"startVerse":24,"endChapter":19,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 19:32-39', 'jos-p45', 8, 6045, '{"id":"jos-p45","sequence":45,"verseRange":"19:32-39","startChapter":19,"startVerse":32,"endChapter":19,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 19:40-48', 'jos-p46', 9, 6046, '{"id":"jos-p46","sequence":46,"verseRange":"19:40-48","startChapter":19,"startVerse":40,"endChapter":19,"endVerse":48}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 19:49-51', 'jos-p47', 3, 6047, '{"id":"jos-p47","sequence":47,"verseRange":"19:49-51","startChapter":19,"startVerse":49,"endChapter":19,"endVerse":51}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 20:1-9', 'jos-p48', 9, 6048, '{"id":"jos-p48","sequence":48,"verseRange":"20:1-9","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 21:1-8', 'jos-p49', 8, 6049, '{"id":"jos-p49","sequence":49,"verseRange":"21:1-8","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 21:9-19', 'jos-p50', 11, 6050, '{"id":"jos-p50","sequence":50,"verseRange":"21:9-19","startChapter":21,"startVerse":9,"endChapter":21,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 21:20-26', 'jos-p51', 7, 6051, '{"id":"jos-p51","sequence":51,"verseRange":"21:20-26","startChapter":21,"startVerse":20,"endChapter":21,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 21:27-33', 'jos-p52', 7, 6052, '{"id":"jos-p52","sequence":52,"verseRange":"21:27-33","startChapter":21,"startVerse":27,"endChapter":21,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 21:34-40', 'jos-p53', 7, 6053, '{"id":"jos-p53","sequence":53,"verseRange":"21:34-40","startChapter":21,"startVerse":34,"endChapter":21,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 21:41-45', 'jos-p54', 5, 6054, '{"id":"jos-p54","sequence":54,"verseRange":"21:41-45","startChapter":21,"startVerse":41,"endChapter":21,"endVerse":45}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 22:1-12', 'jos-p55', 12, 6055, '{"id":"jos-p55","sequence":55,"verseRange":"22:1-12","startChapter":22,"startVerse":1,"endChapter":22,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 22:13-20', 'jos-p56', 8, 6056, '{"id":"jos-p56","sequence":56,"verseRange":"22:13-20","startChapter":22,"startVerse":13,"endChapter":22,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 22:21-34', 'jos-p57', 14, 6057, '{"id":"jos-p57","sequence":57,"verseRange":"22:21-34","startChapter":22,"startVerse":21,"endChapter":22,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 23:1-8', 'jos-p58a', 8, 6058, '{"id":"jos-p58a","sequence":58,"verseRange":"23:1-8","startChapter":23,"startVerse":1,"endChapter":23,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 23:9-16', 'jos-p58b', 8, 6058, '{"id":"jos-p58b","sequence":58,"verseRange":"23:9-16","startChapter":23,"startVerse":9,"endChapter":23,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 24:1-13', 'jos-p59', 13, 6059, '{"id":"jos-p59","sequence":59,"verseRange":"24:1-13","startChapter":24,"startVerse":1,"endChapter":24,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 24:14-28', 'jos-p60', 15, 6060, '{"id":"jos-p60","sequence":60,"verseRange":"24:14-28","startChapter":24,"startVerse":14,"endChapter":24,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Joshua 24:29-33', 'jos-p61', 5, 6061, '{"id":"jos-p61","sequence":61,"verseRange":"24:29-33","startChapter":24,"startVerse":29,"endChapter":24,"endVerse":33}'::jsonb);

-- Judges
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Judges', 'jdg', 61, 7000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 1:1-8', 'jdg-p1', 8, 7001, '{"id":"jdg-p1","sequence":1,"verseRange":"1:1-8","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 1:9-17', 'jdg-p2', 9, 7002, '{"id":"jdg-p2","sequence":2,"verseRange":"1:9-17","startChapter":1,"startVerse":9,"endChapter":1,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 1:18-26', 'jdg-p3', 9, 7003, '{"id":"jdg-p3","sequence":3,"verseRange":"1:18-26","startChapter":1,"startVerse":18,"endChapter":1,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 1:27-36', 'jdg-p4', 10, 7004, '{"id":"jdg-p4","sequence":4,"verseRange":"1:27-36","startChapter":1,"startVerse":27,"endChapter":1,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 2:1-10', 'jdg-p5', 10, 7005, '{"id":"jdg-p5","sequence":5,"verseRange":"2:1-10","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 2:11-19', 'jdg-p6', 9, 7006, '{"id":"jdg-p6","sequence":6,"verseRange":"2:11-19","startChapter":2,"startVerse":11,"endChapter":2,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 2:20-3:6', 'jdg-p7', 10, 7007, '{"id":"jdg-p7","sequence":7,"verseRange":"2:20-3:6","startChapter":2,"startVerse":20,"endChapter":3,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 3:7-11', 'jdg-p8', 5, 7008, '{"id":"jdg-p8","sequence":8,"verseRange":"3:7-11","startChapter":3,"startVerse":7,"endChapter":3,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 3:12-31', 'jdg-p9', 20, 7009, '{"id":"jdg-p9","sequence":9,"verseRange":"3:12-31","startChapter":3,"startVerse":12,"endChapter":3,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 4:1-10', 'jdg-p10a', 10, 7010, '{"id":"jdg-p10a","sequence":10,"verseRange":"4:1-10","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 4:11-24', 'jdg-p10b', 14, 7010, '{"id":"jdg-p10b","sequence":10,"verseRange":"4:11-24","startChapter":4,"startVerse":11,"endChapter":4,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 5:1-11a', 'jdg-p11a', 11, 7011, '{"id":"jdg-p11a","sequence":11,"verseRange":"5:1-11a","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 5:11b-18', 'jdg-p11b', 8, 7011, '{"id":"jdg-p11b","sequence":11,"verseRange":"5:11b-18","startChapter":5,"startVerse":11,"endChapter":5,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 5:19-23', 'jdg-p11c', 5, 7011, '{"id":"jdg-p11c","sequence":11,"verseRange":"5:19-23","startChapter":5,"startVerse":19,"endChapter":5,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 5:24-31', 'jdg-p11d', 8, 7011, '{"id":"jdg-p11d","sequence":11,"verseRange":"5:24-31","startChapter":5,"startVerse":24,"endChapter":5,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 6:1-10', 'jdg-p12', 10, 7012, '{"id":"jdg-p12","sequence":12,"verseRange":"6:1-10","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 6:11-27', 'jdg-p13', 17, 7013, '{"id":"jdg-p13","sequence":13,"verseRange":"6:11-27","startChapter":6,"startVerse":11,"endChapter":6,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 6:28-40', 'jdg-p14', 13, 7014, '{"id":"jdg-p14","sequence":14,"verseRange":"6:28-40","startChapter":6,"startVerse":28,"endChapter":6,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 7:1-8', 'jdg-p15', 8, 7015, '{"id":"jdg-p15","sequence":15,"verseRange":"7:1-8","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 7:9-15', 'jdg-p16a', 7, 7016, '{"id":"jdg-p16a","sequence":16,"verseRange":"7:9-15","startChapter":7,"startVerse":9,"endChapter":7,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 7:16-25', 'jdg-p16b', 10, 7016, '{"id":"jdg-p16b","sequence":16,"verseRange":"7:16-25","startChapter":7,"startVerse":16,"endChapter":7,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 8:1-3', 'jdg-p17', 3, 7017, '{"id":"jdg-p17","sequence":17,"verseRange":"8:1-3","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":3}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 8:4-21', 'jdg-p18', 18, 7018, '{"id":"jdg-p18","sequence":18,"verseRange":"8:4-21","startChapter":8,"startVerse":4,"endChapter":8,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 8:22-35', 'jdg-p19', 14, 7019, '{"id":"jdg-p19","sequence":19,"verseRange":"8:22-35","startChapter":8,"startVerse":22,"endChapter":8,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 9:1-6', 'jdg-p20', 6, 7020, '{"id":"jdg-p20","sequence":20,"verseRange":"9:1-6","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 9:7-21', 'jdg-p21', 15, 7021, '{"id":"jdg-p21","sequence":21,"verseRange":"9:7-21","startChapter":9,"startVerse":7,"endChapter":9,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 9:22-29', 'jdg-p22', 8, 7022, '{"id":"jdg-p22","sequence":22,"verseRange":"9:22-29","startChapter":9,"startVerse":22,"endChapter":9,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 9:30-41', 'jdg-p23', 12, 7023, '{"id":"jdg-p23","sequence":23,"verseRange":"9:30-41","startChapter":9,"startVerse":30,"endChapter":9,"endVerse":41}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 9:42-49', 'jdg-p24', 8, 7024, '{"id":"jdg-p24","sequence":24,"verseRange":"9:42-49","startChapter":9,"startVerse":42,"endChapter":9,"endVerse":49}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 9:50-57', 'jdg-p25', 8, 7025, '{"id":"jdg-p25","sequence":25,"verseRange":"9:50-57","startChapter":9,"startVerse":50,"endChapter":9,"endVerse":57}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 10:1-5', 'jdg-p26', 5, 7026, '{"id":"jdg-p26","sequence":26,"verseRange":"10:1-5","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 10:6-16', 'jdg-p27', 11, 7027, '{"id":"jdg-p27","sequence":27,"verseRange":"10:6-16","startChapter":10,"startVerse":6,"endChapter":10,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 10:17-11:11', 'jdg-p28', 13, 7028, '{"id":"jdg-p28","sequence":28,"verseRange":"10:17-11:11","startChapter":10,"startVerse":17,"endChapter":11,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 11:12-28', 'jdg-p29', 17, 7029, '{"id":"jdg-p29","sequence":29,"verseRange":"11:12-28","startChapter":11,"startVerse":12,"endChapter":11,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 11:29-33', 'jdg-p30a', 5, 7030, '{"id":"jdg-p30a","sequence":30,"verseRange":"11:29-33","startChapter":11,"startVerse":29,"endChapter":11,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 11:34-40', 'jdg-p30b', 7, 7030, '{"id":"jdg-p30b","sequence":30,"verseRange":"11:34-40","startChapter":11,"startVerse":34,"endChapter":11,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 12:1-7', 'jdg-p31', 7, 7031, '{"id":"jdg-p31","sequence":31,"verseRange":"12:1-7","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 12:8-15', 'jdg-p32', 8, 7032, '{"id":"jdg-p32","sequence":32,"verseRange":"12:8-15","startChapter":12,"startVerse":8,"endChapter":12,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 13:1-7', 'jdg-p33a', 7, 7033, '{"id":"jdg-p33a","sequence":33,"verseRange":"13:1-7","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 13:8-25', 'jdg-p33b', 18, 7033, '{"id":"jdg-p33b","sequence":33,"verseRange":"13:8-25","startChapter":13,"startVerse":8,"endChapter":13,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 14:1-9', 'jdg-p34a', 9, 7034, '{"id":"jdg-p34a","sequence":34,"verseRange":"14:1-9","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 14:10-20', 'jdg-p34b', 11, 7034, '{"id":"jdg-p34b","sequence":34,"verseRange":"14:10-20","startChapter":14,"startVerse":10,"endChapter":14,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 15:1-8', 'jdg-p35', 8, 7035, '{"id":"jdg-p35","sequence":35,"verseRange":"15:1-8","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 15:9-20', 'jdg-p36', 12, 7036, '{"id":"jdg-p36","sequence":36,"verseRange":"15:9-20","startChapter":15,"startVerse":9,"endChapter":15,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 16:1-3', 'jdg-p37', 3, 7037, '{"id":"jdg-p37","sequence":37,"verseRange":"16:1-3","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":3}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 16:4-14', 'jdg-p38a', 11, 7038, '{"id":"jdg-p38a","sequence":38,"verseRange":"16:4-14","startChapter":16,"startVerse":4,"endChapter":16,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 16:15-22', 'jdg-p38b', 8, 7038, '{"id":"jdg-p38b","sequence":38,"verseRange":"16:15-22","startChapter":16,"startVerse":15,"endChapter":16,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 16:23-31', 'jdg-p39', 9, 7039, '{"id":"jdg-p39","sequence":39,"verseRange":"16:23-31","startChapter":16,"startVerse":23,"endChapter":16,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 17:1-13', 'jdg-p40', 13, 7040, '{"id":"jdg-p40","sequence":40,"verseRange":"17:1-13","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 18:1-10', 'jdg-p41', 10, 7041, '{"id":"jdg-p41","sequence":41,"verseRange":"18:1-10","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 18:11-21', 'jdg-p42', 11, 7042, '{"id":"jdg-p42","sequence":42,"verseRange":"18:11-21","startChapter":18,"startVerse":11,"endChapter":18,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 18:22-31', 'jdg-p43', 10, 7043, '{"id":"jdg-p43","sequence":43,"verseRange":"18:22-31","startChapter":18,"startVerse":22,"endChapter":18,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 19:1-10', 'jdg-p44a', 10, 7044, '{"id":"jdg-p44a","sequence":44,"verseRange":"19:1-10","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 19:11-21', 'jdg-p44b', 11, 7044, '{"id":"jdg-p44b","sequence":44,"verseRange":"19:11-21","startChapter":19,"startVerse":11,"endChapter":19,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 19:22-30', 'jdg-p45', 9, 7045, '{"id":"jdg-p45","sequence":45,"verseRange":"19:22-30","startChapter":19,"startVerse":22,"endChapter":19,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 20:1-11', 'jdg-p46', 11, 7046, '{"id":"jdg-p46","sequence":46,"verseRange":"20:1-11","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 20:12-25', 'jdg-p47', 14, 7047, '{"id":"jdg-p47","sequence":47,"verseRange":"20:12-25","startChapter":20,"startVerse":12,"endChapter":20,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 20:26-35', 'jdg-p48a', 10, 7048, '{"id":"jdg-p48a","sequence":48,"verseRange":"20:26-35","startChapter":20,"startVerse":26,"endChapter":20,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 20:36-48', 'jdg-p48b', 13, 7048, '{"id":"jdg-p48b","sequence":48,"verseRange":"20:36-48","startChapter":20,"startVerse":36,"endChapter":20,"endVerse":48}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 21:1-12', 'jdg-p49', 12, 7049, '{"id":"jdg-p49","sequence":49,"verseRange":"21:1-12","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Judges 21:13-25', 'jdg-p50', 13, 7050, '{"id":"jdg-p50","sequence":50,"verseRange":"21:13-25","startChapter":21,"startVerse":13,"endChapter":21,"endVerse":25}'::jsonb);

-- Ruth
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Ruth', 'rut', 0, 8000, NULL
);

-- 1 Samuel
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '1 Samuel', '1sa', 69, 9000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 1:1-8', '1sa-p1', 8, 9001, '{"id":"1sa-p1","sequence":1,"verseRange":"1:1-8","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 1:9-18', '1sa-p2', 10, 9002, '{"id":"1sa-p2","sequence":2,"verseRange":"1:9-18","startChapter":1,"startVerse":9,"endChapter":1,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 1:19-28', '1sa-p3', 10, 9003, '{"id":"1sa-p3","sequence":3,"verseRange":"1:19-28","startChapter":1,"startVerse":19,"endChapter":1,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 2:1-11', '1sa-p4', 11, 9004, '{"id":"1sa-p4","sequence":4,"verseRange":"2:1-11","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 2:12-26', '1sa-p5', 15, 9005, '{"id":"1sa-p5","sequence":5,"verseRange":"2:12-26","startChapter":2,"startVerse":12,"endChapter":2,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 2:27-36', '1sa-p6', 10, 9006, '{"id":"1sa-p6","sequence":6,"verseRange":"2:27-36","startChapter":2,"startVerse":27,"endChapter":2,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 3:1-14', '1sa-p7', 14, 9007, '{"id":"1sa-p7","sequence":7,"verseRange":"3:1-14","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 3:15-4:1a', '1sa-p8', 8, 9008, '{"id":"1sa-p8","sequence":8,"verseRange":"3:15-4:1a","startChapter":3,"startVerse":15,"endChapter":4,"endVerse":1}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 4:1b-11', '1sa-p9', 11, 9009, '{"id":"1sa-p9","sequence":9,"verseRange":"4:1b-11","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 4:12-22', '1sa-p10', 11, 9010, '{"id":"1sa-p10","sequence":10,"verseRange":"4:12-22","startChapter":4,"startVerse":12,"endChapter":4,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 5:1-12', '1sa-p11', 12, 9011, '{"id":"1sa-p11","sequence":11,"verseRange":"5:1-12","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 6:1-18', '1sa-p12', 18, 9012, '{"id":"1sa-p12","sequence":12,"verseRange":"6:1-18","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 6:19-7:2', '1sa-p13', 5, 9013, '{"id":"1sa-p13","sequence":13,"verseRange":"6:19-7:2","startChapter":6,"startVerse":19,"endChapter":7,"endVerse":2}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 7:3-17', '1sa-p14', 15, 9014, '{"id":"1sa-p14","sequence":14,"verseRange":"7:3-17","startChapter":7,"startVerse":3,"endChapter":7,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 8:1-9', '1sa-p15', 9, 9015, '{"id":"1sa-p15","sequence":15,"verseRange":"8:1-9","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 8:10-22', '1sa-p16', 13, 9016, '{"id":"1sa-p16","sequence":16,"verseRange":"8:10-22","startChapter":8,"startVerse":10,"endChapter":8,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 9:1-14', '1sa-p17', 14, 9017, '{"id":"1sa-p17","sequence":17,"verseRange":"9:1-14","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 9:15-27', '1sa-p18', 13, 9018, '{"id":"1sa-p18","sequence":18,"verseRange":"9:15-27","startChapter":9,"startVerse":15,"endChapter":9,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 10:1-16', '1sa-p19', 16, 9019, '{"id":"1sa-p19","sequence":19,"verseRange":"10:1-16","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 10:17-27', '1sa-p20', 11, 9020, '{"id":"1sa-p20","sequence":20,"verseRange":"10:17-27","startChapter":10,"startVerse":17,"endChapter":10,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 11:1-15', '1sa-p21', 15, 9021, '{"id":"1sa-p21","sequence":21,"verseRange":"11:1-15","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 12:1-17', '1sa-p22', 17, 9022, '{"id":"1sa-p22","sequence":22,"verseRange":"12:1-17","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 12:18-25', '1sa-p23', 8, 9023, '{"id":"1sa-p23","sequence":23,"verseRange":"12:18-25","startChapter":12,"startVerse":18,"endChapter":12,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 13:1-14', '1sa-p24', 14, 9024, '{"id":"1sa-p24","sequence":24,"verseRange":"13:1-14","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 13:15-23', '1sa-p25', 9, 9025, '{"id":"1sa-p25","sequence":25,"verseRange":"13:15-23","startChapter":13,"startVerse":15,"endChapter":13,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 14:1-15', '1sa-p26', 15, 9026, '{"id":"1sa-p26","sequence":26,"verseRange":"14:1-15","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 14:16-23', '1sa-p27', 8, 9027, '{"id":"1sa-p27","sequence":27,"verseRange":"14:16-23","startChapter":14,"startVerse":16,"endChapter":14,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 14:24-35', '1sa-p28', 12, 9028, '{"id":"1sa-p28","sequence":28,"verseRange":"14:24-35","startChapter":14,"startVerse":24,"endChapter":14,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 14:36-46', '1sa-p29', 11, 9029, '{"id":"1sa-p29","sequence":29,"verseRange":"14:36-46","startChapter":14,"startVerse":36,"endChapter":14,"endVerse":46}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 14:47-52', '1sa-p30', 6, 9030, '{"id":"1sa-p30","sequence":30,"verseRange":"14:47-52","startChapter":14,"startVerse":47,"endChapter":14,"endVerse":52}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 15:1-9', '1sa-p31', 9, 9031, '{"id":"1sa-p31","sequence":31,"verseRange":"15:1-9","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 15:10-23', '1sa-p32', 14, 9032, '{"id":"1sa-p32","sequence":32,"verseRange":"15:10-23","startChapter":15,"startVerse":10,"endChapter":15,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 15:24-35', '1sa-p33', 12, 9033, '{"id":"1sa-p33","sequence":33,"verseRange":"15:24-35","startChapter":15,"startVerse":24,"endChapter":15,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 16:1-13', '1sa-p34', 13, 9034, '{"id":"1sa-p34","sequence":34,"verseRange":"16:1-13","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 16:14-23', '1sa-p35', 10, 9035, '{"id":"1sa-p35","sequence":35,"verseRange":"16:14-23","startChapter":16,"startVerse":14,"endChapter":16,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 17:1-11', '1sa-p36', 11, 9036, '{"id":"1sa-p36","sequence":36,"verseRange":"17:1-11","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 17:12-19', '1sa-p37', 8, 9037, '{"id":"1sa-p37","sequence":37,"verseRange":"17:12-19","startChapter":17,"startVerse":12,"endChapter":17,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 17:20-30', '1sa-p38', 11, 9038, '{"id":"1sa-p38","sequence":38,"verseRange":"17:20-30","startChapter":17,"startVerse":20,"endChapter":17,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 17:31-40', '1sa-p39', 10, 9039, '{"id":"1sa-p39","sequence":39,"verseRange":"17:31-40","startChapter":17,"startVerse":31,"endChapter":17,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 17:41-54', '1sa-p40', 14, 9040, '{"id":"1sa-p40","sequence":40,"verseRange":"17:41-54","startChapter":17,"startVerse":41,"endChapter":17,"endVerse":54}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 17:55-18:5', '1sa-p41', 9, 9041, '{"id":"1sa-p41","sequence":41,"verseRange":"17:55-18:5","startChapter":17,"startVerse":55,"endChapter":18,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 18:6-16', '1sa-p42', 11, 9042, '{"id":"1sa-p42","sequence":42,"verseRange":"18:6-16","startChapter":18,"startVerse":6,"endChapter":18,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 18:17-30', '1sa-p43', 14, 9043, '{"id":"1sa-p43","sequence":43,"verseRange":"18:17-30","startChapter":18,"startVerse":17,"endChapter":18,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 19:1-10', '1sa-p44', 10, 9044, '{"id":"1sa-p44","sequence":44,"verseRange":"19:1-10","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 19:11-24', '1sa-p45', 14, 9045, '{"id":"1sa-p45","sequence":45,"verseRange":"19:11-24","startChapter":19,"startVerse":11,"endChapter":19,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 20:1-17', '1sa-p46', 17, 9046, '{"id":"1sa-p46","sequence":46,"verseRange":"20:1-17","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 20:18-34', '1sa-p47', 17, 9047, '{"id":"1sa-p47","sequence":47,"verseRange":"20:18-34","startChapter":20,"startVerse":18,"endChapter":20,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 20:35-42', '1sa-p48', 8, 9048, '{"id":"1sa-p48","sequence":48,"verseRange":"20:35-42","startChapter":20,"startVerse":35,"endChapter":20,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 21:1-9', '1sa-p49a', 9, 9049, '{"id":"1sa-p49a","sequence":49,"verseRange":"21:1-9","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 21:10-15', '1sa-p49b', 6, 9049, '{"id":"1sa-p49b","sequence":49,"verseRange":"21:10-15","startChapter":21,"startVerse":10,"endChapter":21,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 22:1-10', '1sa-p50', 10, 9050, '{"id":"1sa-p50","sequence":50,"verseRange":"22:1-10","startChapter":22,"startVerse":1,"endChapter":22,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 22:11-23', '1sa-p51', 13, 9051, '{"id":"1sa-p51","sequence":51,"verseRange":"22:11-23","startChapter":22,"startVerse":11,"endChapter":22,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 23:1-14', '1sa-p52', 14, 9052, '{"id":"1sa-p52","sequence":52,"verseRange":"23:1-14","startChapter":23,"startVerse":1,"endChapter":23,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 23:15-29', '1sa-p53', 15, 9053, '{"id":"1sa-p53","sequence":53,"verseRange":"23:15-29","startChapter":23,"startVerse":15,"endChapter":23,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 24:1-7', '1sa-p54', 7, 9054, '{"id":"1sa-p54","sequence":54,"verseRange":"24:1-7","startChapter":24,"startVerse":1,"endChapter":24,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 24:8-22', '1sa-p55', 15, 9055, '{"id":"1sa-p55","sequence":55,"verseRange":"24:8-22","startChapter":24,"startVerse":8,"endChapter":24,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 25:1-13', '1sa-p56', 13, 9056, '{"id":"1sa-p56","sequence":56,"verseRange":"25:1-13","startChapter":25,"startVerse":1,"endChapter":25,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 25:14-22', '1sa-p57', 9, 9057, '{"id":"1sa-p57","sequence":57,"verseRange":"25:14-22","startChapter":25,"startVerse":14,"endChapter":25,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 25:23-38', '1sa-p58', 16, 9058, '{"id":"1sa-p58","sequence":58,"verseRange":"25:23-38","startChapter":25,"startVerse":23,"endChapter":25,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 25:39-44', '1sa-p59', 6, 9059, '{"id":"1sa-p59","sequence":59,"verseRange":"25:39-44","startChapter":25,"startVerse":39,"endChapter":25,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 26:1-12', '1sa-p60', 12, 9060, '{"id":"1sa-p60","sequence":60,"verseRange":"26:1-12","startChapter":26,"startVerse":1,"endChapter":26,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 26:13-25', '1sa-p61', 13, 9061, '{"id":"1sa-p61","sequence":61,"verseRange":"26:13-25","startChapter":26,"startVerse":13,"endChapter":26,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 27:1-28:2', '1sa-p62', 14, 9062, '{"id":"1sa-p62","sequence":62,"verseRange":"27:1-28:2","startChapter":27,"startVerse":1,"endChapter":28,"endVerse":2}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 28:3-14', '1sa-p63', 12, 9063, '{"id":"1sa-p63","sequence":63,"verseRange":"28:3-14","startChapter":28,"startVerse":3,"endChapter":28,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 28:15-25', '1sa-p64', 11, 9064, '{"id":"1sa-p64","sequence":64,"verseRange":"28:15-25","startChapter":28,"startVerse":15,"endChapter":28,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 29:1-11', '1sa-p65', 11, 9065, '{"id":"1sa-p65","sequence":65,"verseRange":"29:1-11","startChapter":29,"startVerse":1,"endChapter":29,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 30:1-15', '1sa-p66', 15, 9066, '{"id":"1sa-p66","sequence":66,"verseRange":"30:1-15","startChapter":30,"startVerse":1,"endChapter":30,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 30:16-31', '1sa-p67', 16, 9067, '{"id":"1sa-p67","sequence":67,"verseRange":"30:16-31","startChapter":30,"startVerse":16,"endChapter":30,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Samuel 31:1-13', '1sa-p68', 13, 9068, '{"id":"1sa-p68","sequence":68,"verseRange":"31:1-13","startChapter":31,"startVerse":1,"endChapter":31,"endVerse":13}'::jsonb);

-- 2 Samuel
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '2 Samuel', '2sa', 65, 10000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 1:1-16', '2sa-p1', 16, 10001, '{"id":"2sa-p1","sequence":1,"verseRange":"1:1-16","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 1:17-27', '2sa-p2', 11, 10002, '{"id":"2sa-p2","sequence":2,"verseRange":"1:17-27","startChapter":1,"startVerse":17,"endChapter":1,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 2:1-7', '2sa-p3', 7, 10003, '{"id":"2sa-p3","sequence":3,"verseRange":"2:1-7","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 2:8-11', '2sa-p4', 4, 10004, '{"id":"2sa-p4","sequence":4,"verseRange":"2:8-11","startChapter":2,"startVerse":8,"endChapter":2,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 2:12-17', '2sa-p5', 6, 10005, '{"id":"2sa-p5","sequence":5,"verseRange":"2:12-17","startChapter":2,"startVerse":12,"endChapter":2,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 2:18-3:1', '2sa-p6', 16, 10006, '{"id":"2sa-p6","sequence":6,"verseRange":"2:18-3:1","startChapter":2,"startVerse":18,"endChapter":3,"endVerse":1}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 3:2-5', '2sa-p7', 4, 10007, '{"id":"2sa-p7","sequence":7,"verseRange":"3:2-5","startChapter":3,"startVerse":2,"endChapter":3,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 3:6-21', '2sa-p8', 16, 10008, '{"id":"2sa-p8","sequence":8,"verseRange":"3:6-21","startChapter":3,"startVerse":6,"endChapter":3,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 3:22-30', '2sa-p9', 9, 10009, '{"id":"2sa-p9","sequence":9,"verseRange":"3:22-30","startChapter":3,"startVerse":22,"endChapter":3,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 3:31-39', '2sa-p10', 9, 10010, '{"id":"2sa-p10","sequence":10,"verseRange":"3:31-39","startChapter":3,"startVerse":31,"endChapter":3,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 4:1-12', '2sa-p11', 12, 10011, '{"id":"2sa-p11","sequence":11,"verseRange":"4:1-12","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 5:1-16', '2sa-p12', 16, 10012, '{"id":"2sa-p12","sequence":12,"verseRange":"5:1-16","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 5:17-25', '2sa-p13', 9, 10013, '{"id":"2sa-p13","sequence":13,"verseRange":"5:17-25","startChapter":5,"startVerse":17,"endChapter":5,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 6:1-15', '2sa-p14', 15, 10014, '{"id":"2sa-p14","sequence":14,"verseRange":"6:1-15","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 6:16-23', '2sa-p15', 8, 10015, '{"id":"2sa-p15","sequence":15,"verseRange":"6:16-23","startChapter":6,"startVerse":16,"endChapter":6,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 7:1-17', '2sa-p16', 17, 10016, '{"id":"2sa-p16","sequence":16,"verseRange":"7:1-17","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 7:18-29', '2sa-p17', 12, 10017, '{"id":"2sa-p17","sequence":17,"verseRange":"7:18-29","startChapter":7,"startVerse":18,"endChapter":7,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 8:1-14', '2sa-p18', 14, 10018, '{"id":"2sa-p18","sequence":18,"verseRange":"8:1-14","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 8:15-18', '2sa-p19', 4, 10019, '{"id":"2sa-p19","sequence":19,"verseRange":"8:15-18","startChapter":8,"startVerse":15,"endChapter":8,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 9:1-13', '2sa-p20', 13, 10020, '{"id":"2sa-p20","sequence":20,"verseRange":"9:1-13","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 10:1-19', '2sa-p21', 19, 10021, '{"id":"2sa-p21","sequence":21,"verseRange":"10:1-19","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 11:1-13', '2sa-p22', 13, 10022, '{"id":"2sa-p22","sequence":22,"verseRange":"11:1-13","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 11:14-27', '2sa-p23', 14, 10023, '{"id":"2sa-p23","sequence":23,"verseRange":"11:14-27","startChapter":11,"startVerse":14,"endChapter":11,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 12:1-15a', '2sa-p24', 15, 10024, '{"id":"2sa-p24","sequence":24,"verseRange":"12:1-15a","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 12:15b-25', '2sa-p25', 11, 10025, '{"id":"2sa-p25","sequence":25,"verseRange":"12:15b-25","startChapter":12,"startVerse":15,"endChapter":12,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 12:26-31', '2sa-p26', 6, 10026, '{"id":"2sa-p26","sequence":26,"verseRange":"12:26-31","startChapter":12,"startVerse":26,"endChapter":12,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 13:1-9', '2sa-p27a', 9, 10027, '{"id":"2sa-p27a","sequence":27,"verseRange":"13:1-9","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 13:10-22', '2sa-p27b', 13, 10027, '{"id":"2sa-p27b","sequence":27,"verseRange":"13:10-22","startChapter":13,"startVerse":10,"endChapter":13,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 13:23-39', '2sa-p28', 17, 10028, '{"id":"2sa-p28","sequence":28,"verseRange":"13:23-39","startChapter":13,"startVerse":23,"endChapter":13,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 14:1-11', '2sa-p29a', 11, 10029, '{"id":"2sa-p29a","sequence":29,"verseRange":"14:1-11","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 14:12-24', '2sa-p29b', 13, 10029, '{"id":"2sa-p29b","sequence":29,"verseRange":"14:12-24","startChapter":14,"startVerse":12,"endChapter":14,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 14:25-33', '2sa-p30', 9, 10030, '{"id":"2sa-p30","sequence":30,"verseRange":"14:25-33","startChapter":14,"startVerse":25,"endChapter":14,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 15:1-12', '2sa-p31', 12, 10031, '{"id":"2sa-p31","sequence":31,"verseRange":"15:1-12","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 15:13-23', '2sa-p32', 11, 10032, '{"id":"2sa-p32","sequence":32,"verseRange":"15:13-23","startChapter":15,"startVerse":13,"endChapter":15,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 15:24-37', '2sa-p33', 14, 10033, '{"id":"2sa-p33","sequence":33,"verseRange":"15:24-37","startChapter":15,"startVerse":24,"endChapter":15,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 16:1-4', '2sa-p34', 4, 10034, '{"id":"2sa-p34","sequence":34,"verseRange":"16:1-4","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 16:5-14', '2sa-p35', 10, 10035, '{"id":"2sa-p35","sequence":35,"verseRange":"16:5-14","startChapter":16,"startVerse":5,"endChapter":16,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 16:15-23', '2sa-p36', 9, 10036, '{"id":"2sa-p36","sequence":36,"verseRange":"16:15-23","startChapter":16,"startVerse":15,"endChapter":16,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 17:1-14', '2sa-p37', 14, 10037, '{"id":"2sa-p37","sequence":37,"verseRange":"17:1-14","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 17:15-29', '2sa-p38', 15, 10038, '{"id":"2sa-p38","sequence":38,"verseRange":"17:15-29","startChapter":17,"startVerse":15,"endChapter":17,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 18:1-8', '2sa-p39a', 8, 10039, '{"id":"2sa-p39a","sequence":39,"verseRange":"18:1-8","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 18:9-18', '2sa-p39b', 10, 10039, '{"id":"2sa-p39b","sequence":39,"verseRange":"18:9-18","startChapter":18,"startVerse":9,"endChapter":18,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 18:19-33', '2sa-p40', 15, 10040, '{"id":"2sa-p40","sequence":40,"verseRange":"18:19-33","startChapter":18,"startVerse":19,"endChapter":18,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 19:1-8a', '2sa-p41', 8, 10041, '{"id":"2sa-p41","sequence":41,"verseRange":"19:1-8a","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 19:8b-18a', '2sa-p42', 11, 10042, '{"id":"2sa-p42","sequence":42,"verseRange":"19:8b-18a","startChapter":19,"startVerse":8,"endChapter":19,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 19:18b-23', '2sa-p43', 6, 10043, '{"id":"2sa-p43","sequence":43,"verseRange":"19:18b-23","startChapter":19,"startVerse":18,"endChapter":19,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 19:24-30', '2sa-p44', 7, 10044, '{"id":"2sa-p44","sequence":44,"verseRange":"19:24-30","startChapter":19,"startVerse":24,"endChapter":19,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 19:31-39', '2sa-p45', 9, 10045, '{"id":"2sa-p45","sequence":45,"verseRange":"19:31-39","startChapter":19,"startVerse":31,"endChapter":19,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 19:40-43', '2sa-p46', 4, 10046, '{"id":"2sa-p46","sequence":46,"verseRange":"19:40-43","startChapter":19,"startVerse":40,"endChapter":19,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 20:1-22', '2sa-p47', 22, 10047, '{"id":"2sa-p47","sequence":47,"verseRange":"20:1-22","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 20:23-26', '2sa-p48', 4, 10048, '{"id":"2sa-p48","sequence":48,"verseRange":"20:23-26","startChapter":20,"startVerse":23,"endChapter":20,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 21:1-14', '2sa-p49', 14, 10049, '{"id":"2sa-p49","sequence":49,"verseRange":"21:1-14","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 21:15-22', '2sa-p50', 8, 10050, '{"id":"2sa-p50","sequence":50,"verseRange":"21:15-22","startChapter":21,"startVerse":15,"endChapter":21,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 22:1-4', '2sa-p51a', 4, 10051, '{"id":"2sa-p51a","sequence":51,"verseRange":"22:1-4","startChapter":22,"startVerse":1,"endChapter":22,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 22:5-20', '2sa-p51b', 16, 10051, '{"id":"2sa-p51b","sequence":51,"verseRange":"22:5-20","startChapter":22,"startVerse":5,"endChapter":22,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 22:21-29', '2sa-p51c', 9, 10051, '{"id":"2sa-p51c","sequence":51,"verseRange":"22:21-29","startChapter":22,"startVerse":21,"endChapter":22,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 22:30-46', '2sa-p51d', 17, 10051, '{"id":"2sa-p51d","sequence":51,"verseRange":"22:30-46","startChapter":22,"startVerse":30,"endChapter":22,"endVerse":46}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 22:47-51', '2sa-p51e', 5, 10051, '{"id":"2sa-p51e","sequence":51,"verseRange":"22:47-51","startChapter":22,"startVerse":47,"endChapter":22,"endVerse":51}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 23:1-7', '2sa-p52', 7, 10052, '{"id":"2sa-p52","sequence":52,"verseRange":"23:1-7","startChapter":23,"startVerse":1,"endChapter":23,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 23:8-17', '2sa-p53', 10, 10053, '{"id":"2sa-p53","sequence":53,"verseRange":"23:8-17","startChapter":23,"startVerse":8,"endChapter":23,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 23:18-23', '2sa-p54', 6, 10054, '{"id":"2sa-p54","sequence":54,"verseRange":"23:18-23","startChapter":23,"startVerse":18,"endChapter":23,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 23:24-39', '2sa-p55', 16, 10055, '{"id":"2sa-p55","sequence":55,"verseRange":"23:24-39","startChapter":23,"startVerse":24,"endChapter":23,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 24:1-9', '2sa-p56', 9, 10056, '{"id":"2sa-p56","sequence":56,"verseRange":"24:1-9","startChapter":24,"startVerse":1,"endChapter":24,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 24:10-17', '2sa-p57', 8, 10057, '{"id":"2sa-p57","sequence":57,"verseRange":"24:10-17","startChapter":24,"startVerse":10,"endChapter":24,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Samuel 24:18-25', '2sa-p58', 8, 10058, '{"id":"2sa-p58","sequence":58,"verseRange":"24:18-25","startChapter":24,"startVerse":18,"endChapter":24,"endVerse":25}'::jsonb);

-- 1 Kings
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '1 Kings', '1ki', 67, 11000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 1:1-4', '1ki-p1a', 4, 11001, '{"id":"1ki-p1a","sequence":1,"verseRange":"1:1-4","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 1:5-10', '1ki-p1b', 6, 11001, '{"id":"1ki-p1b","sequence":1,"verseRange":"1:5-10","startChapter":1,"startVerse":5,"endChapter":1,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 1:11-27', '1ki-p2', 17, 11002, '{"id":"1ki-p2","sequence":2,"verseRange":"1:11-27","startChapter":1,"startVerse":11,"endChapter":1,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 1:28-37', '1ki-p3', 10, 11003, '{"id":"1ki-p3","sequence":3,"verseRange":"1:28-37","startChapter":1,"startVerse":28,"endChapter":1,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 1:38-53', '1ki-p4', 16, 11004, '{"id":"1ki-p4","sequence":4,"verseRange":"1:38-53","startChapter":1,"startVerse":38,"endChapter":1,"endVerse":53}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 2:1-12', '1ki-p5', 12, 11005, '{"id":"1ki-p5","sequence":5,"verseRange":"2:1-12","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 2:13-25', '1ki-p6', 13, 11006, '{"id":"1ki-p6","sequence":6,"verseRange":"2:13-25","startChapter":2,"startVerse":13,"endChapter":2,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 2:26-35', '1ki-p7', 10, 11007, '{"id":"1ki-p7","sequence":7,"verseRange":"2:26-35","startChapter":2,"startVerse":26,"endChapter":2,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 2:36-46', '1ki-p8', 11, 11008, '{"id":"1ki-p8","sequence":8,"verseRange":"2:36-46","startChapter":2,"startVerse":36,"endChapter":2,"endVerse":46}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 3:1-15', '1ki-p9', 15, 11009, '{"id":"1ki-p9","sequence":9,"verseRange":"3:1-15","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 3:16-28', '1ki-p10', 13, 11010, '{"id":"1ki-p10","sequence":10,"verseRange":"3:16-28","startChapter":3,"startVerse":16,"endChapter":3,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 4:1-19', '1ki-p11', 19, 11011, '{"id":"1ki-p11","sequence":11,"verseRange":"4:1-19","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 4:20-28', '1ki-p12', 9, 11012, '{"id":"1ki-p12","sequence":12,"verseRange":"4:20-28","startChapter":4,"startVerse":20,"endChapter":4,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 4:29-34', '1ki-p13', 6, 11013, '{"id":"1ki-p13","sequence":13,"verseRange":"4:29-34","startChapter":4,"startVerse":29,"endChapter":4,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 5:1-12', '1ki-p14', 12, 11014, '{"id":"1ki-p14","sequence":14,"verseRange":"5:1-12","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 5:13-18', '1ki-p15', 6, 11015, '{"id":"1ki-p15","sequence":15,"verseRange":"5:13-18","startChapter":5,"startVerse":13,"endChapter":5,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 6:1-13', '1ki-p16', 13, 11016, '{"id":"1ki-p16","sequence":16,"verseRange":"6:1-13","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 6:14-38', '1ki-p17', 25, 11017, '{"id":"1ki-p17","sequence":17,"verseRange":"6:14-38","startChapter":6,"startVerse":14,"endChapter":6,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 7:1-12', '1ki-p18', 12, 11018, '{"id":"1ki-p18","sequence":18,"verseRange":"7:1-12","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 7:13-22', '1ki-p19', 10, 11019, '{"id":"1ki-p19","sequence":19,"verseRange":"7:13-22","startChapter":7,"startVerse":13,"endChapter":7,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 7:23-39', '1ki-p20', 17, 11020, '{"id":"1ki-p20","sequence":20,"verseRange":"7:23-39","startChapter":7,"startVerse":23,"endChapter":7,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 7:40-51', '1ki-p21', 12, 11021, '{"id":"1ki-p21","sequence":21,"verseRange":"7:40-51","startChapter":7,"startVerse":40,"endChapter":7,"endVerse":51}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 8:12-21', '1ki-p23', 10, 11023, '{"id":"1ki-p23","sequence":23,"verseRange":"8:12-21","startChapter":8,"startVerse":12,"endChapter":8,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 8:22-30', '1ki-p24', 9, 11024, '{"id":"1ki-p24","sequence":24,"verseRange":"8:22-30","startChapter":8,"startVerse":22,"endChapter":8,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 8:54-61', '1ki-p26', 8, 11026, '{"id":"1ki-p26","sequence":26,"verseRange":"8:54-61","startChapter":8,"startVerse":54,"endChapter":8,"endVerse":61}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 8:62-66', '1ki-p27', 5, 11027, '{"id":"1ki-p27","sequence":27,"verseRange":"8:62-66","startChapter":8,"startVerse":62,"endChapter":8,"endVerse":66}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 9:1-9', '1ki-p28', 9, 11028, '{"id":"1ki-p28","sequence":28,"verseRange":"9:1-9","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 9:10-25', '1ki-p29', 16, 11029, '{"id":"1ki-p29","sequence":29,"verseRange":"9:10-25","startChapter":9,"startVerse":10,"endChapter":9,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 9:26-10:13', '1ki-p30', 16, 11030, '{"id":"1ki-p30","sequence":30,"verseRange":"9:26-10:13","startChapter":9,"startVerse":26,"endChapter":10,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 10:14-29', '1ki-p31', 16, 11031, '{"id":"1ki-p31","sequence":31,"verseRange":"10:14-29","startChapter":10,"startVerse":14,"endChapter":10,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 11:14-25', '1ki-p33', 12, 11033, '{"id":"1ki-p33","sequence":33,"verseRange":"11:14-25","startChapter":11,"startVerse":14,"endChapter":11,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 11:26-43', '1ki-p34', 18, 11034, '{"id":"1ki-p34","sequence":34,"verseRange":"11:26-43","startChapter":11,"startVerse":26,"endChapter":11,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 12:1-15', '1ki-p35', 15, 11035, '{"id":"1ki-p35","sequence":35,"verseRange":"12:1-15","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 12:16-24', '1ki-p36', 9, 11036, '{"id":"1ki-p36","sequence":36,"verseRange":"12:16-24","startChapter":12,"startVerse":16,"endChapter":12,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 12:25-33', '1ki-p37', 9, 11037, '{"id":"1ki-p37","sequence":37,"verseRange":"12:25-33","startChapter":12,"startVerse":25,"endChapter":12,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 13:1-10', '1ki-p38', 10, 11038, '{"id":"1ki-p38","sequence":38,"verseRange":"13:1-10","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 13:11-22', '1ki-p39a', 12, 11039, '{"id":"1ki-p39a","sequence":39,"verseRange":"13:11-22","startChapter":13,"startVerse":11,"endChapter":13,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 13:23-34', '1ki-p39b', 12, 11039, '{"id":"1ki-p39b","sequence":39,"verseRange":"13:23-34","startChapter":13,"startVerse":23,"endChapter":13,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 14:1-11', '1ki-p40a', 11, 11040, '{"id":"1ki-p40a","sequence":40,"verseRange":"14:1-11","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 14:12-20', '1ki-p40b', 9, 11040, '{"id":"1ki-p40b","sequence":40,"verseRange":"14:12-20","startChapter":14,"startVerse":12,"endChapter":14,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 14:21-31', '1ki-p41', 11, 11041, '{"id":"1ki-p41","sequence":41,"verseRange":"14:21-31","startChapter":14,"startVerse":21,"endChapter":14,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 15:1-8', '1ki-p42', 8, 11042, '{"id":"1ki-p42","sequence":42,"verseRange":"15:1-8","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 15:25-32', '1ki-p44', 8, 11044, '{"id":"1ki-p44","sequence":44,"verseRange":"15:25-32","startChapter":15,"startVerse":25,"endChapter":15,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 15:33-16:7', '1ki-p45', 9, 11045, '{"id":"1ki-p45","sequence":45,"verseRange":"15:33-16:7","startChapter":15,"startVerse":33,"endChapter":16,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 16:8-14', '1ki-p46', 7, 11046, '{"id":"1ki-p46","sequence":46,"verseRange":"16:8-14","startChapter":16,"startVerse":8,"endChapter":16,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 16:15-20', '1ki-p47', 6, 11047, '{"id":"1ki-p47","sequence":47,"verseRange":"16:15-20","startChapter":16,"startVerse":15,"endChapter":16,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 16:21-28', '1ki-p48', 8, 11048, '{"id":"1ki-p48","sequence":48,"verseRange":"16:21-28","startChapter":16,"startVerse":21,"endChapter":16,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 16:29-34', '1ki-p49', 6, 11049, '{"id":"1ki-p49","sequence":49,"verseRange":"16:29-34","startChapter":16,"startVerse":29,"endChapter":16,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 17:1-7', '1ki-p50', 7, 11050, '{"id":"1ki-p50","sequence":50,"verseRange":"17:1-7","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 17:8-16', '1ki-p51', 9, 11051, '{"id":"1ki-p51","sequence":51,"verseRange":"17:8-16","startChapter":17,"startVerse":8,"endChapter":17,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 17:17-24', '1ki-p52', 8, 11052, '{"id":"1ki-p52","sequence":52,"verseRange":"17:17-24","startChapter":17,"startVerse":17,"endChapter":17,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 18:1-15', '1ki-p53', 15, 11053, '{"id":"1ki-p53","sequence":53,"verseRange":"18:1-15","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 18:16-29', '1ki-p54', 14, 11054, '{"id":"1ki-p54","sequence":54,"verseRange":"18:16-29","startChapter":18,"startVerse":16,"endChapter":18,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 18:30-40', '1ki-p55', 11, 11055, '{"id":"1ki-p55","sequence":55,"verseRange":"18:30-40","startChapter":18,"startVerse":30,"endChapter":18,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 18:41-46', '1ki-p56', 6, 11056, '{"id":"1ki-p56","sequence":56,"verseRange":"18:41-46","startChapter":18,"startVerse":41,"endChapter":18,"endVerse":46}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 19:1-8', '1ki-p57', 8, 11057, '{"id":"1ki-p57","sequence":57,"verseRange":"19:1-8","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 19:9-21', '1ki-p58', 13, 11058, '{"id":"1ki-p58","sequence":58,"verseRange":"19:9-21","startChapter":19,"startVerse":9,"endChapter":19,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 20:1-12', '1ki-p59', 12, 11059, '{"id":"1ki-p59","sequence":59,"verseRange":"20:1-12","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 20:13-22', '1ki-p60', 10, 11060, '{"id":"1ki-p60","sequence":60,"verseRange":"20:13-22","startChapter":20,"startVerse":13,"endChapter":20,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 20:23-34', '1ki-p61', 12, 11061, '{"id":"1ki-p61","sequence":61,"verseRange":"20:23-34","startChapter":20,"startVerse":23,"endChapter":20,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 20:35-43', '1ki-p62', 9, 11062, '{"id":"1ki-p62","sequence":62,"verseRange":"20:35-43","startChapter":20,"startVerse":35,"endChapter":20,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 21:1-16', '1ki-p63', 16, 11063, '{"id":"1ki-p63","sequence":63,"verseRange":"21:1-16","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 21:17-29', '1ki-p64', 13, 11064, '{"id":"1ki-p64","sequence":64,"verseRange":"21:17-29","startChapter":21,"startVerse":17,"endChapter":21,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 22:1-12', '1ki-p65', 12, 11065, '{"id":"1ki-p65","sequence":65,"verseRange":"22:1-12","startChapter":22,"startVerse":1,"endChapter":22,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 22:13-28', '1ki-p66', 16, 11066, '{"id":"1ki-p66","sequence":66,"verseRange":"22:13-28","startChapter":22,"startVerse":13,"endChapter":22,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 22:29-40', '1ki-p67', 12, 11067, '{"id":"1ki-p67","sequence":67,"verseRange":"22:29-40","startChapter":22,"startVerse":29,"endChapter":22,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Kings 22:41-53', '1ki-p68', 13, 11068, '{"id":"1ki-p68","sequence":68,"verseRange":"22:41-53","startChapter":22,"startVerse":41,"endChapter":22,"endVerse":53}'::jsonb);

-- 2 Kings
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', '2 Kings', '2ki', 0, 12000, NULL
);

-- 1 Chronicles
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '1 Chronicles', '1ch', 92, 13000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 1:1-7', '1ch-p1', 7, 13001, '{"id":"1ch-p1","sequence":1,"verseRange":"1:1-7","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 1:8-16', '1ch-p2', 9, 13002, '{"id":"1ch-p2","sequence":2,"verseRange":"1:8-16","startChapter":1,"startVerse":8,"endChapter":1,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 1:17-27', '1ch-p3', 11, 13003, '{"id":"1ch-p3","sequence":3,"verseRange":"1:17-27","startChapter":1,"startVerse":17,"endChapter":1,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 1:28-33', '1ch-p4', 6, 13004, '{"id":"1ch-p4","sequence":4,"verseRange":"1:28-33","startChapter":1,"startVerse":28,"endChapter":1,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 1:34-37', '1ch-p5', 4, 13005, '{"id":"1ch-p5","sequence":5,"verseRange":"1:34-37","startChapter":1,"startVerse":34,"endChapter":1,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 1:38-42', '1ch-p6', 5, 13006, '{"id":"1ch-p6","sequence":6,"verseRange":"1:38-42","startChapter":1,"startVerse":38,"endChapter":1,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 1:43-54', '1ch-p7', 12, 13007, '{"id":"1ch-p7","sequence":7,"verseRange":"1:43-54","startChapter":1,"startVerse":43,"endChapter":1,"endVerse":54}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 2:1-8', '1ch-p8', 8, 13008, '{"id":"1ch-p8","sequence":8,"verseRange":"2:1-8","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 2:9-17', '1ch-p9', 9, 13009, '{"id":"1ch-p9","sequence":9,"verseRange":"2:9-17","startChapter":2,"startVerse":9,"endChapter":2,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 2:18-24', '1ch-p10', 7, 13010, '{"id":"1ch-p10","sequence":10,"verseRange":"2:18-24","startChapter":2,"startVerse":18,"endChapter":2,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 2:25-33', '1ch-p11', 9, 13011, '{"id":"1ch-p11","sequence":11,"verseRange":"2:25-33","startChapter":2,"startVerse":25,"endChapter":2,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 2:34-41', '1ch-p12', 8, 13012, '{"id":"1ch-p12","sequence":12,"verseRange":"2:34-41","startChapter":2,"startVerse":34,"endChapter":2,"endVerse":41}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 2:42-50a', '1ch-p13', 9, 13013, '{"id":"1ch-p13","sequence":13,"verseRange":"2:42-50a","startChapter":2,"startVerse":42,"endChapter":2,"endVerse":50}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 2:50b-55', '1ch-p14', 6, 13014, '{"id":"1ch-p14","sequence":14,"verseRange":"2:50b-55","startChapter":2,"startVerse":50,"endChapter":2,"endVerse":55}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 3:1-9', '1ch-p15', 9, 13015, '{"id":"1ch-p15","sequence":15,"verseRange":"3:1-9","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 3:10-16', '1ch-p16', 7, 13016, '{"id":"1ch-p16","sequence":16,"verseRange":"3:10-16","startChapter":3,"startVerse":10,"endChapter":3,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 3:17-24', '1ch-p17', 8, 13017, '{"id":"1ch-p17","sequence":17,"verseRange":"3:17-24","startChapter":3,"startVerse":17,"endChapter":3,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 4:1-10', '1ch-p18', 10, 13018, '{"id":"1ch-p18","sequence":18,"verseRange":"4:1-10","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 4:11-20', '1ch-p19', 10, 13019, '{"id":"1ch-p19","sequence":19,"verseRange":"4:11-20","startChapter":4,"startVerse":11,"endChapter":4,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 4:21-23', '1ch-p20', 3, 13020, '{"id":"1ch-p20","sequence":20,"verseRange":"4:21-23","startChapter":4,"startVerse":21,"endChapter":4,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 4:24-43', '1ch-p21', 20, 13021, '{"id":"1ch-p21","sequence":21,"verseRange":"4:24-43","startChapter":4,"startVerse":24,"endChapter":4,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 5:1-10', '1ch-p22', 10, 13022, '{"id":"1ch-p22","sequence":22,"verseRange":"5:1-10","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 5:11-17', '1ch-p23', 7, 13023, '{"id":"1ch-p23","sequence":23,"verseRange":"5:11-17","startChapter":5,"startVerse":11,"endChapter":5,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 5:18-26', '1ch-p24', 9, 13024, '{"id":"1ch-p24","sequence":24,"verseRange":"5:18-26","startChapter":5,"startVerse":18,"endChapter":5,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 6:1-15', '1ch-p25', 15, 13025, '{"id":"1ch-p25","sequence":25,"verseRange":"6:1-15","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 6:16-30', '1ch-p26', 15, 13026, '{"id":"1ch-p26","sequence":26,"verseRange":"6:16-30","startChapter":6,"startVerse":16,"endChapter":6,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 7:1-5', '1ch-p30', 5, 13030, '{"id":"1ch-p30","sequence":30,"verseRange":"7:1-5","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 7:6-13', '1ch-p31', 8, 13031, '{"id":"1ch-p31","sequence":31,"verseRange":"7:6-13","startChapter":7,"startVerse":6,"endChapter":7,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 7:14-19', '1ch-p32', 6, 13032, '{"id":"1ch-p32","sequence":32,"verseRange":"7:14-19","startChapter":7,"startVerse":14,"endChapter":7,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 7:20-29', '1ch-p33', 10, 13033, '{"id":"1ch-p33","sequence":33,"verseRange":"7:20-29","startChapter":7,"startVerse":20,"endChapter":7,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 7:30-40', '1ch-p34', 11, 13034, '{"id":"1ch-p34","sequence":34,"verseRange":"7:30-40","startChapter":7,"startVerse":30,"endChapter":7,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 8:1-16', '1ch-p35', 16, 13035, '{"id":"1ch-p35","sequence":35,"verseRange":"8:1-16","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 8:17-28', '1ch-p36', 12, 13036, '{"id":"1ch-p36","sequence":36,"verseRange":"8:17-28","startChapter":8,"startVerse":17,"endChapter":8,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 8:29-40', '1ch-p37', 12, 13037, '{"id":"1ch-p37","sequence":37,"verseRange":"8:29-40","startChapter":8,"startVerse":29,"endChapter":8,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 9:1-9', '1ch-p38', 9, 13038, '{"id":"1ch-p38","sequence":38,"verseRange":"9:1-9","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 9:10-16', '1ch-p39', 7, 13039, '{"id":"1ch-p39","sequence":39,"verseRange":"9:10-16","startChapter":9,"startVerse":10,"endChapter":9,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 9:17-27', '1ch-p40', 11, 13040, '{"id":"1ch-p40","sequence":40,"verseRange":"9:17-27","startChapter":9,"startVerse":17,"endChapter":9,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 9:28-34', '1ch-p41', 7, 13041, '{"id":"1ch-p41","sequence":41,"verseRange":"9:28-34","startChapter":9,"startVerse":28,"endChapter":9,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 9:35-44', '1ch-p42', 10, 13042, '{"id":"1ch-p42","sequence":42,"verseRange":"9:35-44","startChapter":9,"startVerse":35,"endChapter":9,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 10:1-14', '1ch-p43', 14, 13043, '{"id":"1ch-p43","sequence":43,"verseRange":"10:1-14","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 11:1-9', '1ch-p44', 9, 13044, '{"id":"1ch-p44","sequence":44,"verseRange":"11:1-9","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 11:10-19', '1ch-p45', 10, 13045, '{"id":"1ch-p45","sequence":45,"verseRange":"11:10-19","startChapter":11,"startVerse":10,"endChapter":11,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 11:20-25', '1ch-p46', 6, 13046, '{"id":"1ch-p46","sequence":46,"verseRange":"11:20-25","startChapter":11,"startVerse":20,"endChapter":11,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 11:26-47', '1ch-p47', 22, 13047, '{"id":"1ch-p47","sequence":47,"verseRange":"11:26-47","startChapter":11,"startVerse":26,"endChapter":11,"endVerse":47}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 12:1-7', '1ch-p48', 7, 13048, '{"id":"1ch-p48","sequence":48,"verseRange":"12:1-7","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 12:8-15', '1ch-p49', 8, 13049, '{"id":"1ch-p49","sequence":49,"verseRange":"12:8-15","startChapter":12,"startVerse":8,"endChapter":12,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 12:16-18', '1ch-p50', 3, 13050, '{"id":"1ch-p50","sequence":50,"verseRange":"12:16-18","startChapter":12,"startVerse":16,"endChapter":12,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 12:19-22', '1ch-p51', 4, 13051, '{"id":"1ch-p51","sequence":51,"verseRange":"12:19-22","startChapter":12,"startVerse":19,"endChapter":12,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 12:23-40', '1ch-p52', 18, 13052, '{"id":"1ch-p52","sequence":52,"verseRange":"12:23-40","startChapter":12,"startVerse":23,"endChapter":12,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 13:1-14', '1ch-p53', 14, 13053, '{"id":"1ch-p53","sequence":53,"verseRange":"13:1-14","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 14:1-7', '1ch-p54', 7, 13054, '{"id":"1ch-p54","sequence":54,"verseRange":"14:1-7","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 14:8-17', '1ch-p55', 10, 13055, '{"id":"1ch-p55","sequence":55,"verseRange":"14:8-17","startChapter":14,"startVerse":8,"endChapter":14,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 15:1-24', '1ch-p56', 24, 13056, '{"id":"1ch-p56","sequence":56,"verseRange":"15:1-24","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 15:25-16:7', '1ch-p57', 12, 13057, '{"id":"1ch-p57","sequence":57,"verseRange":"15:25-16:7","startChapter":15,"startVerse":25,"endChapter":16,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 16:8-13', '1ch-p58a', 6, 13058, '{"id":"1ch-p58a","sequence":58,"verseRange":"16:8-13","startChapter":16,"startVerse":8,"endChapter":16,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 16:14-22', '1ch-p58b', 9, 13058, '{"id":"1ch-p58b","sequence":58,"verseRange":"16:14-22","startChapter":16,"startVerse":14,"endChapter":16,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 16:23-33', '1ch-p58c', 11, 13058, '{"id":"1ch-p58c","sequence":58,"verseRange":"16:23-33","startChapter":16,"startVerse":23,"endChapter":16,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 16:34-36', '1ch-p58d', 3, 13058, '{"id":"1ch-p58d","sequence":58,"verseRange":"16:34-36","startChapter":16,"startVerse":34,"endChapter":16,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 16:37-43', '1ch-p59', 7, 13059, '{"id":"1ch-p59","sequence":59,"verseRange":"16:37-43","startChapter":16,"startVerse":37,"endChapter":16,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 17:1-15', '1ch-p60', 15, 13060, '{"id":"1ch-p60","sequence":60,"verseRange":"17:1-15","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 17:16-27', '1ch-p61', 12, 13061, '{"id":"1ch-p61","sequence":61,"verseRange":"17:16-27","startChapter":17,"startVerse":16,"endChapter":17,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 18:1-13', '1ch-p62', 13, 13062, '{"id":"1ch-p62","sequence":62,"verseRange":"18:1-13","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 18:14-17', '1ch-p63', 4, 13063, '{"id":"1ch-p63","sequence":63,"verseRange":"18:14-17","startChapter":18,"startVerse":14,"endChapter":18,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 19:1-9', '1ch-p64', 9, 13064, '{"id":"1ch-p64","sequence":64,"verseRange":"19:1-9","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 19:10-19', '1ch-p65', 10, 13065, '{"id":"1ch-p65","sequence":65,"verseRange":"19:10-19","startChapter":19,"startVerse":10,"endChapter":19,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 20:1-3', '1ch-p66', 3, 13066, '{"id":"1ch-p66","sequence":66,"verseRange":"20:1-3","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":3}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 20:4-8', '1ch-p67', 5, 13067, '{"id":"1ch-p67","sequence":67,"verseRange":"20:4-8","startChapter":20,"startVerse":4,"endChapter":20,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 21:1-6', '1ch-p68', 6, 13068, '{"id":"1ch-p68","sequence":68,"verseRange":"21:1-6","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 21:7-17', '1ch-p69', 11, 13069, '{"id":"1ch-p69","sequence":69,"verseRange":"21:7-17","startChapter":21,"startVerse":7,"endChapter":21,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 21:18-22:1', '1ch-p70', 14, 13070, '{"id":"1ch-p70","sequence":70,"verseRange":"21:18-22:1","startChapter":21,"startVerse":18,"endChapter":22,"endVerse":1}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 22:2-19', '1ch-p71', 18, 13071, '{"id":"1ch-p71","sequence":71,"verseRange":"22:2-19","startChapter":22,"startVerse":2,"endChapter":22,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 23:1-6', '1ch-p72', 6, 13072, '{"id":"1ch-p72","sequence":72,"verseRange":"23:1-6","startChapter":23,"startVerse":1,"endChapter":23,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 23:7-11', '1ch-p73', 5, 13073, '{"id":"1ch-p73","sequence":73,"verseRange":"23:7-11","startChapter":23,"startVerse":7,"endChapter":23,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 23:12-20', '1ch-p74', 9, 13074, '{"id":"1ch-p74","sequence":74,"verseRange":"23:12-20","startChapter":23,"startVerse":12,"endChapter":23,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 23:21-32', '1ch-p75', 12, 13075, '{"id":"1ch-p75","sequence":75,"verseRange":"23:21-32","startChapter":23,"startVerse":21,"endChapter":23,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 24:1-19', '1ch-p76', 19, 13076, '{"id":"1ch-p76","sequence":76,"verseRange":"24:1-19","startChapter":24,"startVerse":1,"endChapter":24,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 24:20-31', '1ch-p77', 12, 13077, '{"id":"1ch-p77","sequence":77,"verseRange":"24:20-31","startChapter":24,"startVerse":20,"endChapter":24,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 25:1-7', '1ch-p78a', 7, 13078, '{"id":"1ch-p78a","sequence":78,"verseRange":"25:1-7","startChapter":25,"startVerse":1,"endChapter":25,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 25:8-31', '1ch-p78b', 24, 13078, '{"id":"1ch-p78b","sequence":78,"verseRange":"25:8-31","startChapter":25,"startVerse":8,"endChapter":25,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 26:1-19', '1ch-p79', 19, 13079, '{"id":"1ch-p79","sequence":79,"verseRange":"26:1-19","startChapter":26,"startVerse":1,"endChapter":26,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 26:20-28', '1ch-p80', 9, 13080, '{"id":"1ch-p80","sequence":80,"verseRange":"26:20-28","startChapter":26,"startVerse":20,"endChapter":26,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 26:29-32', '1ch-p81', 4, 13081, '{"id":"1ch-p81","sequence":81,"verseRange":"26:29-32","startChapter":26,"startVerse":29,"endChapter":26,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 27:1-15', '1ch-p82', 15, 13082, '{"id":"1ch-p82","sequence":82,"verseRange":"27:1-15","startChapter":27,"startVerse":1,"endChapter":27,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 27:16-24', '1ch-p83', 9, 13083, '{"id":"1ch-p83","sequence":83,"verseRange":"27:16-24","startChapter":27,"startVerse":16,"endChapter":27,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 27:25-31', '1ch-p84', 7, 13084, '{"id":"1ch-p84","sequence":84,"verseRange":"27:25-31","startChapter":27,"startVerse":25,"endChapter":27,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 27:32-34', '1ch-p85', 3, 13085, '{"id":"1ch-p85","sequence":85,"verseRange":"27:32-34","startChapter":27,"startVerse":32,"endChapter":27,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 28:1-8', '1ch-p86', 8, 13086, '{"id":"1ch-p86","sequence":86,"verseRange":"28:1-8","startChapter":28,"startVerse":1,"endChapter":28,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 28:9-21', '1ch-p87', 13, 13087, '{"id":"1ch-p87","sequence":87,"verseRange":"28:9-21","startChapter":28,"startVerse":9,"endChapter":28,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 29:1-9', '1ch-p88', 9, 13088, '{"id":"1ch-p88","sequence":88,"verseRange":"29:1-9","startChapter":29,"startVerse":1,"endChapter":29,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 29:10-20', '1ch-p89', 11, 13089, '{"id":"1ch-p89","sequence":89,"verseRange":"29:10-20","startChapter":29,"startVerse":10,"endChapter":29,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 29:21-25', '1ch-p90', 5, 13090, '{"id":"1ch-p90","sequence":90,"verseRange":"29:21-25","startChapter":29,"startVerse":21,"endChapter":29,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Chronicles 29:26-30', '1ch-p91', 5, 13091, '{"id":"1ch-p91","sequence":91,"verseRange":"29:26-30","startChapter":29,"startVerse":26,"endChapter":29,"endVerse":30}'::jsonb);

-- 2 Chronicles
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', '2 Chronicles', '2ch', 0, 14000, NULL
);

-- Ezra
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Ezra', 'ezr', 0, 15000, NULL
);

-- Nehemiah
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Nehemiah', 'neh', 0, 16000, NULL
);

-- Esther
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Esther', 'est', 0, 17000, NULL
);

-- Job
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Job', 'job', 5, 18000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Job 1:1-5', 'job-p1', 5, 18001, '{"id":"job-p1","sequence":1,"verseRange":"1:1-5","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Job 1:6-12', 'job-p2', 7, 18002, '{"id":"job-p2","sequence":2,"verseRange":"1:6-12","startChapter":1,"startVerse":6,"endChapter":1,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Job 1:13-22', 'job-p3', 10, 18003, '{"id":"job-p3","sequence":3,"verseRange":"1:13-22","startChapter":1,"startVerse":13,"endChapter":1,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Job 2:1-6', 'job-p4', 6, 18004, '{"id":"job-p4","sequence":4,"verseRange":"2:1-6","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Job 2:7-13', 'job-p5', 7, 18005, '{"id":"job-p5","sequence":5,"verseRange":"2:7-13","startChapter":2,"startVerse":7,"endChapter":2,"endVerse":13}'::jsonb);

-- Psalms
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Psalms', 'psa', 3, 19000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Psalms 1:1-6', 'psa-p1', 6, 19001, '{"id":"psa-p1","sequence":1,"verseRange":"1:1-6","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Psalms 3:1-8', 'psa-p3', 8, 19003, '{"id":"psa-p3","sequence":3,"verseRange":"3:1-8","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Psalms 117:1-2', 'psa-p117', 2, 19117, '{"id":"psa-p117","sequence":117,"verseRange":"117:1-2","startChapter":117,"startVerse":1,"endChapter":117,"endVerse":2}'::jsonb);

-- Proverbs
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Proverbs', 'pro', 0, 20000, NULL
);

-- Ecclesiastes
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Ecclesiastes', 'ecc', 0, 21000, NULL
);

-- Song of Solomon
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Song of Solomon', 'sng', 0, 22000, NULL
);

-- Isaiah
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Isaiah', 'isa', 0, 23000, NULL
);

-- Jeremiah
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Jeremiah', 'jer', 0, 24000, NULL
);

-- Lamentations
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Lamentations', 'lam', 0, 25000, NULL
);

-- Ezekiel
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Ezekiel', 'ezk', 0, 26000, NULL
);

-- Daniel
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Daniel', 'dan', 0, 27000, NULL
);

-- Hosea
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Hosea', 'hos', 0, 28000, NULL
);

-- Joel
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Joel', 'jol', 0, 29000, NULL
);

-- Amos
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Amos', 'amo', 0, 30000, NULL
);

-- Obadiah
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Obadiah', 'oba', 0, 31000, NULL
);

-- Jonah
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Jonah', 'jon', 0, 32000, NULL
);

-- Micah
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Micah', 'mic', 0, 33000, NULL
);

-- Nahum
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Nahum', 'nam', 0, 34000, NULL
);

-- Habakkuk
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Habakkuk', 'hab', 0, 35000, NULL
);

-- Zephaniah
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Zephaniah', 'zep', 0, 36000, NULL
);

-- Haggai
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Haggai', 'hag', 0, 37000, NULL
);

-- Zechariah
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Zechariah', 'zec', 0, 38000, NULL
);

-- Malachi
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Malachi', 'mal', 0, 39000, NULL
);

-- Matthew
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Matthew', 'mat', 105, 40000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 1:1-17', 'mat-p1', 17, 40001, '{"id":"mat-p1","sequence":1,"verseRange":"1:1-17","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 1:18-25', 'mat-p2', 8, 40002, '{"id":"mat-p2","sequence":2,"verseRange":"1:18-25","startChapter":1,"startVerse":18,"endChapter":1,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 2:1-12', 'mat-p3', 12, 40003, '{"id":"mat-p3","sequence":3,"verseRange":"2:1-12","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 2:13-23', 'mat-p4', 11, 40004, '{"id":"mat-p4","sequence":4,"verseRange":"2:13-23","startChapter":2,"startVerse":13,"endChapter":2,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 3:1-17', 'mat-p5', 17, 40005, '{"id":"mat-p5","sequence":5,"verseRange":"3:1-17","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 4:1-11', 'mat-p6', 11, 40006, '{"id":"mat-p6","sequence":6,"verseRange":"4:1-11","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 4:12-25', 'mat-p7', 14, 40007, '{"id":"mat-p7","sequence":7,"verseRange":"4:12-25","startChapter":4,"startVerse":12,"endChapter":4,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 5:1-12', 'mat-p8', 12, 40008, '{"id":"mat-p8","sequence":8,"verseRange":"5:1-12","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 5:13-16', 'mat-p9', 4, 40009, '{"id":"mat-p9","sequence":9,"verseRange":"5:13-16","startChapter":5,"startVerse":13,"endChapter":5,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 5:17-26', 'mat-p10', 10, 40010, '{"id":"mat-p10","sequence":10,"verseRange":"5:17-26","startChapter":5,"startVerse":17,"endChapter":5,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 5:27-32', 'mat-p11', 6, 40011, '{"id":"mat-p11","sequence":11,"verseRange":"5:27-32","startChapter":5,"startVerse":27,"endChapter":5,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 5:33-42', 'mat-p12', 10, 40012, '{"id":"mat-p12","sequence":12,"verseRange":"5:33-42","startChapter":5,"startVerse":33,"endChapter":5,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 5:43-48', 'mat-p13', 6, 40013, '{"id":"mat-p13","sequence":13,"verseRange":"5:43-48","startChapter":5,"startVerse":43,"endChapter":5,"endVerse":48}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 6:1-8', 'mat-p14', 8, 40014, '{"id":"mat-p14","sequence":14,"verseRange":"6:1-8","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 6:9-18', 'mat-p15', 10, 40015, '{"id":"mat-p15","sequence":15,"verseRange":"6:9-18","startChapter":6,"startVerse":9,"endChapter":6,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 6:19-34', 'mat-p16', 16, 40016, '{"id":"mat-p16","sequence":16,"verseRange":"6:19-34","startChapter":6,"startVerse":19,"endChapter":6,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 7:1-12', 'mat-p17', 12, 40017, '{"id":"mat-p17","sequence":17,"verseRange":"7:1-12","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 7:13-29', 'mat-p18', 17, 40018, '{"id":"mat-p18","sequence":18,"verseRange":"7:13-29","startChapter":7,"startVerse":13,"endChapter":7,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 8:1-17', 'mat-p19', 17, 40019, '{"id":"mat-p19","sequence":19,"verseRange":"8:1-17","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 8:18-22', 'mat-p20', 5, 40020, '{"id":"mat-p20","sequence":20,"verseRange":"8:18-22","startChapter":8,"startVerse":18,"endChapter":8,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 8:23-27', 'mat-p21', 5, 40021, '{"id":"mat-p21","sequence":21,"verseRange":"8:23-27","startChapter":8,"startVerse":23,"endChapter":8,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 8:28-34', 'mat-p22', 7, 40022, '{"id":"mat-p22","sequence":22,"verseRange":"8:28-34","startChapter":8,"startVerse":28,"endChapter":8,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 9:1-8', 'mat-p23', 8, 40023, '{"id":"mat-p23","sequence":23,"verseRange":"9:1-8","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 9:9-13', 'mat-p24', 5, 40024, '{"id":"mat-p24","sequence":24,"verseRange":"9:9-13","startChapter":9,"startVerse":9,"endChapter":9,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 9:14-17', 'mat-p25', 4, 40025, '{"id":"mat-p25","sequence":25,"verseRange":"9:14-17","startChapter":9,"startVerse":14,"endChapter":9,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 9:18-26', 'mat-p26', 9, 40026, '{"id":"mat-p26","sequence":26,"verseRange":"9:18-26","startChapter":9,"startVerse":18,"endChapter":9,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 9:27-38', 'mat-p27', 12, 40027, '{"id":"mat-p27","sequence":27,"verseRange":"9:27-38","startChapter":9,"startVerse":27,"endChapter":9,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 10:1-15', 'mat-p28', 15, 40028, '{"id":"mat-p28","sequence":28,"verseRange":"10:1-15","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 10:16-25', 'mat-p29', 10, 40029, '{"id":"mat-p29","sequence":29,"verseRange":"10:16-25","startChapter":10,"startVerse":16,"endChapter":10,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 10:26-33', 'mat-p30', 8, 40030, '{"id":"mat-p30","sequence":30,"verseRange":"10:26-33","startChapter":10,"startVerse":26,"endChapter":10,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 10:34-42', 'mat-p31', 9, 40031, '{"id":"mat-p31","sequence":31,"verseRange":"10:34-42","startChapter":10,"startVerse":34,"endChapter":10,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 11:1-6', 'mat-p32a', 6, 40032, '{"id":"mat-p32a","sequence":32,"verseRange":"11:1-6","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 11:7-19', 'mat-p32b', 13, 40032, '{"id":"mat-p32b","sequence":32,"verseRange":"11:7-19","startChapter":11,"startVerse":7,"endChapter":11,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 11:20-24', 'mat-p33', 5, 40033, '{"id":"mat-p33","sequence":33,"verseRange":"11:20-24","startChapter":11,"startVerse":20,"endChapter":11,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 11:25-30', 'mat-p34', 6, 40034, '{"id":"mat-p34","sequence":34,"verseRange":"11:25-30","startChapter":11,"startVerse":25,"endChapter":11,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 12:1-14', 'mat-p35', 14, 40035, '{"id":"mat-p35","sequence":35,"verseRange":"12:1-14","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 12:15-21', 'mat-p36', 7, 40036, '{"id":"mat-p36","sequence":36,"verseRange":"12:15-21","startChapter":12,"startVerse":15,"endChapter":12,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 12:22-32', 'mat-p37', 11, 40037, '{"id":"mat-p37","sequence":37,"verseRange":"12:22-32","startChapter":12,"startVerse":22,"endChapter":12,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 12:33-37', 'mat-p38', 5, 40038, '{"id":"mat-p38","sequence":38,"verseRange":"12:33-37","startChapter":12,"startVerse":33,"endChapter":12,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 12:38-45', 'mat-p39', 8, 40039, '{"id":"mat-p39","sequence":39,"verseRange":"12:38-45","startChapter":12,"startVerse":38,"endChapter":12,"endVerse":45}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 12:46-50', 'mat-p40', 5, 40040, '{"id":"mat-p40","sequence":40,"verseRange":"12:46-50","startChapter":12,"startVerse":46,"endChapter":12,"endVerse":50}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 13:1-9', 'mat-p41', 9, 40041, '{"id":"mat-p41","sequence":41,"verseRange":"13:1-9","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 13:10-17', 'mat-p42', 8, 40042, '{"id":"mat-p42","sequence":42,"verseRange":"13:10-17","startChapter":13,"startVerse":10,"endChapter":13,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 13:18-23', 'mat-p43', 6, 40043, '{"id":"mat-p43","sequence":43,"verseRange":"13:18-23","startChapter":13,"startVerse":18,"endChapter":13,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 13:24-35', 'mat-p44', 12, 40044, '{"id":"mat-p44","sequence":44,"verseRange":"13:24-35","startChapter":13,"startVerse":24,"endChapter":13,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 13:36-43', 'mat-p45', 8, 40045, '{"id":"mat-p45","sequence":45,"verseRange":"13:36-43","startChapter":13,"startVerse":36,"endChapter":13,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 13:44-53', 'mat-p46', 10, 40046, '{"id":"mat-p46","sequence":46,"verseRange":"13:44-53","startChapter":13,"startVerse":44,"endChapter":13,"endVerse":53}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 13:54-58', 'mat-p47', 5, 40047, '{"id":"mat-p47","sequence":47,"verseRange":"13:54-58","startChapter":13,"startVerse":54,"endChapter":13,"endVerse":58}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 14:1-12', 'mat-p48', 12, 40048, '{"id":"mat-p48","sequence":48,"verseRange":"14:1-12","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 14:13-21', 'mat-p49', 9, 40049, '{"id":"mat-p49","sequence":49,"verseRange":"14:13-21","startChapter":14,"startVerse":13,"endChapter":14,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 14:22-36', 'mat-p50', 15, 40050, '{"id":"mat-p50","sequence":50,"verseRange":"14:22-36","startChapter":14,"startVerse":22,"endChapter":14,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 15:1-20', 'mat-p51', 20, 40051, '{"id":"mat-p51","sequence":51,"verseRange":"15:1-20","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 15:21-28', 'mat-p52', 8, 40052, '{"id":"mat-p52","sequence":52,"verseRange":"15:21-28","startChapter":15,"startVerse":21,"endChapter":15,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 15:29-39', 'mat-p53', 11, 40053, '{"id":"mat-p53","sequence":53,"verseRange":"15:29-39","startChapter":15,"startVerse":29,"endChapter":15,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 16:1-12', 'mat-p54', 12, 40054, '{"id":"mat-p54","sequence":54,"verseRange":"16:1-12","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 16:13-20', 'mat-p55', 8, 40055, '{"id":"mat-p55","sequence":55,"verseRange":"16:13-20","startChapter":16,"startVerse":13,"endChapter":16,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 16:21-28', 'mat-p56', 8, 40056, '{"id":"mat-p56","sequence":56,"verseRange":"16:21-28","startChapter":16,"startVerse":21,"endChapter":16,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 17:1-13', 'mat-p57', 13, 40057, '{"id":"mat-p57","sequence":57,"verseRange":"17:1-13","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 17:14-21', 'mat-p58', 8, 40058, '{"id":"mat-p58","sequence":58,"verseRange":"17:14-21","startChapter":17,"startVerse":14,"endChapter":17,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 17:22-27', 'mat-p59', 6, 40059, '{"id":"mat-p59","sequence":59,"verseRange":"17:22-27","startChapter":17,"startVerse":22,"endChapter":17,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 18:1-9', 'mat-p60', 9, 40060, '{"id":"mat-p60","sequence":60,"verseRange":"18:1-9","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 18:10-14', 'mat-p61', 5, 40061, '{"id":"mat-p61","sequence":61,"verseRange":"18:10-14","startChapter":18,"startVerse":10,"endChapter":18,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 18:15-20', 'mat-p62', 6, 40062, '{"id":"mat-p62","sequence":62,"verseRange":"18:15-20","startChapter":18,"startVerse":15,"endChapter":18,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 18:21-35', 'mat-p63', 15, 40063, '{"id":"mat-p63","sequence":63,"verseRange":"18:21-35","startChapter":18,"startVerse":21,"endChapter":18,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 19:1-12', 'mat-p64', 12, 40064, '{"id":"mat-p64","sequence":64,"verseRange":"19:1-12","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 19:13-30', 'mat-p65', 18, 40065, '{"id":"mat-p65","sequence":65,"verseRange":"19:13-30","startChapter":19,"startVerse":13,"endChapter":19,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 20:1-16', 'mat-p66', 16, 40066, '{"id":"mat-p66","sequence":66,"verseRange":"20:1-16","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 20:17-28', 'mat-p67', 12, 40067, '{"id":"mat-p67","sequence":67,"verseRange":"20:17-28","startChapter":20,"startVerse":17,"endChapter":20,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 20:29-34', 'mat-p68', 6, 40068, '{"id":"mat-p68","sequence":68,"verseRange":"20:29-34","startChapter":20,"startVerse":29,"endChapter":20,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 21:1-11', 'mat-p69', 11, 40069, '{"id":"mat-p69","sequence":69,"verseRange":"21:1-11","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 21:12-22', 'mat-p70', 11, 40070, '{"id":"mat-p70","sequence":70,"verseRange":"21:12-22","startChapter":21,"startVerse":12,"endChapter":21,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 21:23-32', 'mat-p71', 10, 40071, '{"id":"mat-p71","sequence":71,"verseRange":"21:23-32","startChapter":21,"startVerse":23,"endChapter":21,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 21:33-46', 'mat-p72', 14, 40072, '{"id":"mat-p72","sequence":72,"verseRange":"21:33-46","startChapter":21,"startVerse":33,"endChapter":21,"endVerse":46}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 22:1-14', 'mat-p73', 14, 40073, '{"id":"mat-p73","sequence":73,"verseRange":"22:1-14","startChapter":22,"startVerse":1,"endChapter":22,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 22:15-22', 'mat-p74', 8, 40074, '{"id":"mat-p74","sequence":74,"verseRange":"22:15-22","startChapter":22,"startVerse":15,"endChapter":22,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 22:23-33', 'mat-p75', 11, 40075, '{"id":"mat-p75","sequence":75,"verseRange":"22:23-33","startChapter":22,"startVerse":23,"endChapter":22,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 22:34-46', 'mat-p76', 13, 40076, '{"id":"mat-p76","sequence":76,"verseRange":"22:34-46","startChapter":22,"startVerse":34,"endChapter":22,"endVerse":46}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 23:1-12', 'mat-p77', 12, 40077, '{"id":"mat-p77","sequence":77,"verseRange":"23:1-12","startChapter":23,"startVerse":1,"endChapter":23,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 23:13-22', 'mat-p78', 10, 40078, '{"id":"mat-p78","sequence":78,"verseRange":"23:13-22","startChapter":23,"startVerse":13,"endChapter":23,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 23:23-28', 'mat-p79', 6, 40079, '{"id":"mat-p79","sequence":79,"verseRange":"23:23-28","startChapter":23,"startVerse":23,"endChapter":23,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 23:29-36', 'mat-p80', 8, 40080, '{"id":"mat-p80","sequence":80,"verseRange":"23:29-36","startChapter":23,"startVerse":29,"endChapter":23,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 23:37-24:2', 'mat-p81', 5, 40081, '{"id":"mat-p81","sequence":81,"verseRange":"23:37-24:2","startChapter":23,"startVerse":37,"endChapter":24,"endVerse":2}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 24:3-14', 'mat-p82', 12, 40082, '{"id":"mat-p82","sequence":82,"verseRange":"24:3-14","startChapter":24,"startVerse":3,"endChapter":24,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 24:15-28', 'mat-p83', 14, 40083, '{"id":"mat-p83","sequence":83,"verseRange":"24:15-28","startChapter":24,"startVerse":15,"endChapter":24,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 24:29-36', 'mat-p84', 8, 40084, '{"id":"mat-p84","sequence":84,"verseRange":"24:29-36","startChapter":24,"startVerse":29,"endChapter":24,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 24:37-44', 'mat-p85', 8, 40085, '{"id":"mat-p85","sequence":85,"verseRange":"24:37-44","startChapter":24,"startVerse":37,"endChapter":24,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 24:45-51', 'mat-p86', 7, 40086, '{"id":"mat-p86","sequence":86,"verseRange":"24:45-51","startChapter":24,"startVerse":45,"endChapter":24,"endVerse":51}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 25:1-13', 'mat-p87', 13, 40087, '{"id":"mat-p87","sequence":87,"verseRange":"25:1-13","startChapter":25,"startVerse":1,"endChapter":25,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 25:14-30', 'mat-p88', 17, 40088, '{"id":"mat-p88","sequence":88,"verseRange":"25:14-30","startChapter":25,"startVerse":14,"endChapter":25,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 25:31-46', 'mat-p89', 16, 40089, '{"id":"mat-p89","sequence":89,"verseRange":"25:31-46","startChapter":25,"startVerse":31,"endChapter":25,"endVerse":46}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 26:1-16', 'mat-p90', 16, 40090, '{"id":"mat-p90","sequence":90,"verseRange":"26:1-16","startChapter":26,"startVerse":1,"endChapter":26,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 26:17-25', 'mat-p91', 9, 40091, '{"id":"mat-p91","sequence":91,"verseRange":"26:17-25","startChapter":26,"startVerse":17,"endChapter":26,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 26:26-35', 'mat-p92', 10, 40092, '{"id":"mat-p92","sequence":92,"verseRange":"26:26-35","startChapter":26,"startVerse":26,"endChapter":26,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 26:36-46', 'mat-p93', 11, 40093, '{"id":"mat-p93","sequence":93,"verseRange":"26:36-46","startChapter":26,"startVerse":36,"endChapter":26,"endVerse":46}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 26:47-56', 'mat-p94', 10, 40094, '{"id":"mat-p94","sequence":94,"verseRange":"26:47-56","startChapter":26,"startVerse":47,"endChapter":26,"endVerse":56}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 26:57-68', 'mat-p95', 12, 40095, '{"id":"mat-p95","sequence":95,"verseRange":"26:57-68","startChapter":26,"startVerse":57,"endChapter":26,"endVerse":68}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 26:69-75', 'mat-p96', 7, 40096, '{"id":"mat-p96","sequence":96,"verseRange":"26:69-75","startChapter":26,"startVerse":69,"endChapter":26,"endVerse":75}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 27:1-10', 'mat-p97', 10, 40097, '{"id":"mat-p97","sequence":97,"verseRange":"27:1-10","startChapter":27,"startVerse":1,"endChapter":27,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 27:11-26', 'mat-p98', 16, 40098, '{"id":"mat-p98","sequence":98,"verseRange":"27:11-26","startChapter":27,"startVerse":11,"endChapter":27,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 27:27-31', 'mat-p99', 5, 40099, '{"id":"mat-p99","sequence":99,"verseRange":"27:27-31","startChapter":27,"startVerse":27,"endChapter":27,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 27:32-44', 'mat-p100', 13, 40100, '{"id":"mat-p100","sequence":100,"verseRange":"27:32-44","startChapter":27,"startVerse":32,"endChapter":27,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 27:45-56', 'mat-p101', 12, 40101, '{"id":"mat-p101","sequence":101,"verseRange":"27:45-56","startChapter":27,"startVerse":45,"endChapter":27,"endVerse":56}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 27:57-66', 'mat-p102', 10, 40102, '{"id":"mat-p102","sequence":102,"verseRange":"27:57-66","startChapter":27,"startVerse":57,"endChapter":27,"endVerse":66}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 28:1-15', 'mat-p103', 15, 40103, '{"id":"mat-p103","sequence":103,"verseRange":"28:1-15","startChapter":28,"startVerse":1,"endChapter":28,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Matthew 28:16-20', 'mat-p104', 5, 40104, '{"id":"mat-p104","sequence":104,"verseRange":"28:16-20","startChapter":28,"startVerse":16,"endChapter":28,"endVerse":20}'::jsonb);

-- Mark
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Mark', 'mrk', 68, 41000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 1:1-13', 'mrk-p1', 13, 41001, '{"id":"mrk-p1","sequence":1,"verseRange":"1:1-13","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 1:14-20', 'mrk-p2', 7, 41002, '{"id":"mrk-p2","sequence":2,"verseRange":"1:14-20","startChapter":1,"startVerse":14,"endChapter":1,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 1:21-28', 'mrk-p3', 8, 41003, '{"id":"mrk-p3","sequence":3,"verseRange":"1:21-28","startChapter":1,"startVerse":21,"endChapter":1,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 1:29-34', 'mrk-p4', 6, 41004, '{"id":"mrk-p4","sequence":4,"verseRange":"1:29-34","startChapter":1,"startVerse":29,"endChapter":1,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 1:35-39', 'mrk-p5', 5, 41005, '{"id":"mrk-p5","sequence":5,"verseRange":"1:35-39","startChapter":1,"startVerse":35,"endChapter":1,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 1:40-45', 'mrk-p6', 6, 41006, '{"id":"mrk-p6","sequence":6,"verseRange":"1:40-45","startChapter":1,"startVerse":40,"endChapter":1,"endVerse":45}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 2:1-12', 'mrk-p7', 12, 41007, '{"id":"mrk-p7","sequence":7,"verseRange":"2:1-12","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 2:13-17', 'mrk-p8', 5, 41008, '{"id":"mrk-p8","sequence":8,"verseRange":"2:13-17","startChapter":2,"startVerse":13,"endChapter":2,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 2:18-22', 'mrk-p9', 5, 41009, '{"id":"mrk-p9","sequence":9,"verseRange":"2:18-22","startChapter":2,"startVerse":18,"endChapter":2,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 2:23-3:6', 'mrk-p10', 12, 41010, '{"id":"mrk-p10","sequence":10,"verseRange":"2:23-3:6","startChapter":2,"startVerse":23,"endChapter":3,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 3:7-12', 'mrk-p11', 6, 41011, '{"id":"mrk-p11","sequence":11,"verseRange":"3:7-12","startChapter":3,"startVerse":7,"endChapter":3,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 3:13-19', 'mrk-p12', 7, 41012, '{"id":"mrk-p12","sequence":12,"verseRange":"3:13-19","startChapter":3,"startVerse":13,"endChapter":3,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 3:20-35', 'mrk-p13', 16, 41013, '{"id":"mrk-p13","sequence":13,"verseRange":"3:20-35","startChapter":3,"startVerse":20,"endChapter":3,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 4:1-20', 'mrk-p14', 20, 41014, '{"id":"mrk-p14","sequence":14,"verseRange":"4:1-20","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 4:21-25', 'mrk-p15', 5, 41015, '{"id":"mrk-p15","sequence":15,"verseRange":"4:21-25","startChapter":4,"startVerse":21,"endChapter":4,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 4:26-34', 'mrk-p16', 9, 41016, '{"id":"mrk-p16","sequence":16,"verseRange":"4:26-34","startChapter":4,"startVerse":26,"endChapter":4,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 4:35-41', 'mrk-p17', 7, 41017, '{"id":"mrk-p17","sequence":17,"verseRange":"4:35-41","startChapter":4,"startVerse":35,"endChapter":4,"endVerse":41}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 5:1-20', 'mrk-p18', 20, 41018, '{"id":"mrk-p18","sequence":18,"verseRange":"5:1-20","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 5:21-34', 'mrk-p19a', 14, 41019, '{"id":"mrk-p19a","sequence":19,"verseRange":"5:21-34","startChapter":5,"startVerse":21,"endChapter":5,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 5:35-43', 'mrk-p19b', 9, 41019, '{"id":"mrk-p19b","sequence":19,"verseRange":"5:35-43","startChapter":5,"startVerse":35,"endChapter":5,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 6:1-6a', 'mrk-p20', 6, 41020, '{"id":"mrk-p20","sequence":20,"verseRange":"6:1-6a","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 6:6b-13', 'mrk-p21', 8, 41021, '{"id":"mrk-p21","sequence":21,"verseRange":"6:6b-13","startChapter":6,"startVerse":6,"endChapter":6,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 6:14-29', 'mrk-p22', 16, 41022, '{"id":"mrk-p22","sequence":22,"verseRange":"6:14-29","startChapter":6,"startVerse":14,"endChapter":6,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 6:30-44', 'mrk-p23a', 15, 41023, '{"id":"mrk-p23a","sequence":23,"verseRange":"6:30-44","startChapter":6,"startVerse":30,"endChapter":6,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 6:45-56', 'mrk-p23b', 12, 41023, '{"id":"mrk-p23b","sequence":23,"verseRange":"6:45-56","startChapter":6,"startVerse":45,"endChapter":6,"endVerse":56}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 7:1-8', 'mrk-p24a', 8, 41024, '{"id":"mrk-p24a","sequence":24,"verseRange":"7:1-8","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 7:9-13', 'mrk-p24b', 5, 41024, '{"id":"mrk-p24b","sequence":24,"verseRange":"7:9-13","startChapter":7,"startVerse":9,"endChapter":7,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 7:14-23', 'mrk-p24c', 10, 41024, '{"id":"mrk-p24c","sequence":24,"verseRange":"7:14-23","startChapter":7,"startVerse":14,"endChapter":7,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 7:24-30', 'mrk-p25', 7, 41025, '{"id":"mrk-p25","sequence":25,"verseRange":"7:24-30","startChapter":7,"startVerse":24,"endChapter":7,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 7:31-37', 'mrk-p26', 7, 41026, '{"id":"mrk-p26","sequence":26,"verseRange":"7:31-37","startChapter":7,"startVerse":31,"endChapter":7,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 8:1-10', 'mrk-p27a', 10, 41027, '{"id":"mrk-p27a","sequence":27,"verseRange":"8:1-10","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 8:11-21', 'mrk-p27b', 11, 41027, '{"id":"mrk-p27b","sequence":27,"verseRange":"8:11-21","startChapter":8,"startVerse":11,"endChapter":8,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 8:22-26', 'mrk-p28', 5, 41028, '{"id":"mrk-p28","sequence":28,"verseRange":"8:22-26","startChapter":8,"startVerse":22,"endChapter":8,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 8:27-30', 'mrk-p29a', 4, 41029, '{"id":"mrk-p29a","sequence":29,"verseRange":"8:27-30","startChapter":8,"startVerse":27,"endChapter":8,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 8:31-9:1', 'mrk-p29b', 9, 41029, '{"id":"mrk-p29b","sequence":29,"verseRange":"8:31-9:1","startChapter":8,"startVerse":31,"endChapter":9,"endVerse":1}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 9:2-13', 'mrk-p30', 12, 41030, '{"id":"mrk-p30","sequence":30,"verseRange":"9:2-13","startChapter":9,"startVerse":2,"endChapter":9,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 9:14-29', 'mrk-p31', 16, 41031, '{"id":"mrk-p31","sequence":31,"verseRange":"9:14-29","startChapter":9,"startVerse":14,"endChapter":9,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 9:30-50', 'mrk-p32', 21, 41032, '{"id":"mrk-p32","sequence":32,"verseRange":"9:30-50","startChapter":9,"startVerse":30,"endChapter":9,"endVerse":50}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 10:1-12', 'mrk-p33', 12, 41033, '{"id":"mrk-p33","sequence":33,"verseRange":"10:1-12","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 10:13-31', 'mrk-p34', 19, 41034, '{"id":"mrk-p34","sequence":34,"verseRange":"10:13-31","startChapter":10,"startVerse":13,"endChapter":10,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 10:32-45', 'mrk-p35', 14, 41035, '{"id":"mrk-p35","sequence":35,"verseRange":"10:32-45","startChapter":10,"startVerse":32,"endChapter":10,"endVerse":45}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 10:46-52', 'mrk-p36', 7, 41036, '{"id":"mrk-p36","sequence":36,"verseRange":"10:46-52","startChapter":10,"startVerse":46,"endChapter":10,"endVerse":52}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 11:1-11', 'mrk-p37', 11, 41037, '{"id":"mrk-p37","sequence":37,"verseRange":"11:1-11","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 11:12-26', 'mrk-p38', 15, 41038, '{"id":"mrk-p38","sequence":38,"verseRange":"11:12-26","startChapter":11,"startVerse":12,"endChapter":11,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 11:27-33', 'mrk-p39a', 7, 41039, '{"id":"mrk-p39a","sequence":39,"verseRange":"11:27-33","startChapter":11,"startVerse":27,"endChapter":11,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 12:1-12', 'mrk-p39b', 12, 41039, '{"id":"mrk-p39b","sequence":39,"verseRange":"12:1-12","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 12:13-17', 'mrk-p40', 5, 41040, '{"id":"mrk-p40","sequence":40,"verseRange":"12:13-17","startChapter":12,"startVerse":13,"endChapter":12,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 12:18-27', 'mrk-p41', 10, 41041, '{"id":"mrk-p41","sequence":41,"verseRange":"12:18-27","startChapter":12,"startVerse":18,"endChapter":12,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 12:28-34', 'mrk-p42', 7, 41042, '{"id":"mrk-p42","sequence":42,"verseRange":"12:28-34","startChapter":12,"startVerse":28,"endChapter":12,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 12:35-37', 'mrk-p43', 3, 41043, '{"id":"mrk-p43","sequence":43,"verseRange":"12:35-37","startChapter":12,"startVerse":35,"endChapter":12,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 12:38-44', 'mrk-p44', 7, 41044, '{"id":"mrk-p44","sequence":44,"verseRange":"12:38-44","startChapter":12,"startVerse":38,"endChapter":12,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 13:1-8', 'mrk-p45a', 8, 41045, '{"id":"mrk-p45a","sequence":45,"verseRange":"13:1-8","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 13:9-23', 'mrk-p45b', 15, 41045, '{"id":"mrk-p45b","sequence":45,"verseRange":"13:9-23","startChapter":13,"startVerse":9,"endChapter":13,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 13:24-31', 'mrk-p45c', 8, 41045, '{"id":"mrk-p45c","sequence":45,"verseRange":"13:24-31","startChapter":13,"startVerse":24,"endChapter":13,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 13:32-37', 'mrk-p45d', 6, 41045, '{"id":"mrk-p45d","sequence":45,"verseRange":"13:32-37","startChapter":13,"startVerse":32,"endChapter":13,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 14:1-11', 'mrk-p46', 11, 41046, '{"id":"mrk-p46","sequence":46,"verseRange":"14:1-11","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 14:12-26', 'mrk-p47a', 15, 41047, '{"id":"mrk-p47a","sequence":47,"verseRange":"14:12-26","startChapter":14,"startVerse":12,"endChapter":14,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 14:27-31', 'mrk-p47b', 5, 41047, '{"id":"mrk-p47b","sequence":47,"verseRange":"14:27-31","startChapter":14,"startVerse":27,"endChapter":14,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 14:32-42', 'mrk-p48', 11, 41048, '{"id":"mrk-p48","sequence":48,"verseRange":"14:32-42","startChapter":14,"startVerse":32,"endChapter":14,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 14:43-52', 'mrk-p49', 10, 41049, '{"id":"mrk-p49","sequence":49,"verseRange":"14:43-52","startChapter":14,"startVerse":43,"endChapter":14,"endVerse":52}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 14:53-65', 'mrk-p50a', 13, 41050, '{"id":"mrk-p50a","sequence":50,"verseRange":"14:53-65","startChapter":14,"startVerse":53,"endChapter":14,"endVerse":65}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 14:66-72', 'mrk-p50b', 7, 41050, '{"id":"mrk-p50b","sequence":50,"verseRange":"14:66-72","startChapter":14,"startVerse":66,"endChapter":14,"endVerse":72}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 15:1-15', 'mrk-p51', 15, 41051, '{"id":"mrk-p51","sequence":51,"verseRange":"15:1-15","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 15:16-32', 'mrk-p52a', 17, 41052, '{"id":"mrk-p52a","sequence":52,"verseRange":"15:16-32","startChapter":15,"startVerse":16,"endChapter":15,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 15:33-39', 'mrk-p52b', 7, 41052, '{"id":"mrk-p52b","sequence":52,"verseRange":"15:33-39","startChapter":15,"startVerse":33,"endChapter":15,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 15:40-47', 'mrk-p53', 8, 41053, '{"id":"mrk-p53","sequence":53,"verseRange":"15:40-47","startChapter":15,"startVerse":40,"endChapter":15,"endVerse":47}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 16:1-8', 'mrk-p54', 8, 41054, '{"id":"mrk-p54","sequence":54,"verseRange":"16:1-8","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Mark 16:9-20', 'mrk-p55', 12, 41055, '{"id":"mrk-p55","sequence":55,"verseRange":"16:9-20","startChapter":16,"startVerse":9,"endChapter":16,"endVerse":20}'::jsonb);

-- Luke
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Luke', 'luk', 97, 42000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 1:1-4', 'luk-p1', 4, 42001, '{"id":"luk-p1","sequence":1,"verseRange":"1:1-4","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 1:5-25', 'luk-p2', 21, 42002, '{"id":"luk-p2","sequence":2,"verseRange":"1:5-25","startChapter":1,"startVerse":5,"endChapter":1,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 1:26-38', 'luk-p3', 13, 42003, '{"id":"luk-p3","sequence":3,"verseRange":"1:26-38","startChapter":1,"startVerse":26,"endChapter":1,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 1:39-56', 'luk-p4', 18, 42004, '{"id":"luk-p4","sequence":4,"verseRange":"1:39-56","startChapter":1,"startVerse":39,"endChapter":1,"endVerse":56}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 1:57-80', 'luk-p5', 24, 42005, '{"id":"luk-p5","sequence":5,"verseRange":"1:57-80","startChapter":1,"startVerse":57,"endChapter":1,"endVerse":80}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 2:1-21', 'luk-p6', 21, 42006, '{"id":"luk-p6","sequence":6,"verseRange":"2:1-21","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 2:22-40', 'luk-p7', 19, 42007, '{"id":"luk-p7","sequence":7,"verseRange":"2:22-40","startChapter":2,"startVerse":22,"endChapter":2,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 2:41-52', 'luk-p8', 12, 42008, '{"id":"luk-p8","sequence":8,"verseRange":"2:41-52","startChapter":2,"startVerse":41,"endChapter":2,"endVerse":52}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 3:1-14', 'luk-p9', 14, 42009, '{"id":"luk-p9","sequence":9,"verseRange":"3:1-14","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 3:15-22', 'luk-p10', 8, 42010, '{"id":"luk-p10","sequence":10,"verseRange":"3:15-22","startChapter":3,"startVerse":15,"endChapter":3,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 3:23-38', 'luk-p11', 16, 42011, '{"id":"luk-p11","sequence":11,"verseRange":"3:23-38","startChapter":3,"startVerse":23,"endChapter":3,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 4:1-13', 'luk-p12', 13, 42012, '{"id":"luk-p12","sequence":12,"verseRange":"4:1-13","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 4:14-30', 'luk-p13', 17, 42013, '{"id":"luk-p13","sequence":13,"verseRange":"4:14-30","startChapter":4,"startVerse":14,"endChapter":4,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 4:31-44', 'luk-p14', 14, 42014, '{"id":"luk-p14","sequence":14,"verseRange":"4:31-44","startChapter":4,"startVerse":31,"endChapter":4,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 5:1-11', 'luk-p15', 11, 42015, '{"id":"luk-p15","sequence":15,"verseRange":"5:1-11","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 5:12-16', 'luk-p16', 5, 42016, '{"id":"luk-p16","sequence":16,"verseRange":"5:12-16","startChapter":5,"startVerse":12,"endChapter":5,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 5:17-26', 'luk-p17', 10, 42017, '{"id":"luk-p17","sequence":17,"verseRange":"5:17-26","startChapter":5,"startVerse":17,"endChapter":5,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 5:27-39', 'luk-p18', 13, 42018, '{"id":"luk-p18","sequence":18,"verseRange":"5:27-39","startChapter":5,"startVerse":27,"endChapter":5,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 6:1-11', 'luk-p19', 11, 42019, '{"id":"luk-p19","sequence":19,"verseRange":"6:1-11","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 6:12-16', 'luk-p20', 5, 42020, '{"id":"luk-p20","sequence":20,"verseRange":"6:12-16","startChapter":6,"startVerse":12,"endChapter":6,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 6:17-19', 'luk-p21a', 3, 42021, '{"id":"luk-p21a","sequence":21,"verseRange":"6:17-19","startChapter":6,"startVerse":17,"endChapter":6,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 6:20-26', 'luk-p21b', 7, 42021, '{"id":"luk-p21b","sequence":21,"verseRange":"6:20-26","startChapter":6,"startVerse":20,"endChapter":6,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 6:27-36', 'luk-p21c', 10, 42021, '{"id":"luk-p21c","sequence":21,"verseRange":"6:27-36","startChapter":6,"startVerse":27,"endChapter":6,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 6:37-42', 'luk-p21d', 6, 42021, '{"id":"luk-p21d","sequence":21,"verseRange":"6:37-42","startChapter":6,"startVerse":37,"endChapter":6,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 6:43-49', 'luk-p21e', 7, 42021, '{"id":"luk-p21e","sequence":21,"verseRange":"6:43-49","startChapter":6,"startVerse":43,"endChapter":6,"endVerse":49}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 7:1-10', 'luk-p22', 10, 42022, '{"id":"luk-p22","sequence":22,"verseRange":"7:1-10","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 7:11-17', 'luk-p23', 7, 42023, '{"id":"luk-p23","sequence":23,"verseRange":"7:11-17","startChapter":7,"startVerse":11,"endChapter":7,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 7:18-35', 'luk-p24', 18, 42024, '{"id":"luk-p24","sequence":24,"verseRange":"7:18-35","startChapter":7,"startVerse":18,"endChapter":7,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 7:36-8:3', 'luk-p25', 18, 42025, '{"id":"luk-p25","sequence":25,"verseRange":"7:36-8:3","startChapter":7,"startVerse":36,"endChapter":8,"endVerse":3}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 8:4-15', 'luk-p26', 12, 42026, '{"id":"luk-p26","sequence":26,"verseRange":"8:4-15","startChapter":8,"startVerse":4,"endChapter":8,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 8:16-18', 'luk-p27', 3, 42027, '{"id":"luk-p27","sequence":27,"verseRange":"8:16-18","startChapter":8,"startVerse":16,"endChapter":8,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 8:19-21', 'luk-p28', 3, 42028, '{"id":"luk-p28","sequence":28,"verseRange":"8:19-21","startChapter":8,"startVerse":19,"endChapter":8,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 8:22-25', 'luk-p29', 4, 42029, '{"id":"luk-p29","sequence":29,"verseRange":"8:22-25","startChapter":8,"startVerse":22,"endChapter":8,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 8:26-39', 'luk-p30', 14, 42030, '{"id":"luk-p30","sequence":30,"verseRange":"8:26-39","startChapter":8,"startVerse":26,"endChapter":8,"endVerse":39}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 8:40-56', 'luk-p31', 17, 42031, '{"id":"luk-p31","sequence":31,"verseRange":"8:40-56","startChapter":8,"startVerse":40,"endChapter":8,"endVerse":56}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 9:1-17', 'luk-p32a', 17, 42032, '{"id":"luk-p32a","sequence":32,"verseRange":"9:1-17","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 9:18-27', 'luk-p32b', 10, 42032, '{"id":"luk-p32b","sequence":32,"verseRange":"9:18-27","startChapter":9,"startVerse":18,"endChapter":9,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 9:28-36', 'luk-p33', 9, 42033, '{"id":"luk-p33","sequence":33,"verseRange":"9:28-36","startChapter":9,"startVerse":28,"endChapter":9,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 9:37-45', 'luk-p34', 9, 42034, '{"id":"luk-p34","sequence":34,"verseRange":"9:37-45","startChapter":9,"startVerse":37,"endChapter":9,"endVerse":45}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 9:46-62', 'luk-p35', 17, 42035, '{"id":"luk-p35","sequence":35,"verseRange":"9:46-62","startChapter":9,"startVerse":46,"endChapter":9,"endVerse":62}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 10:1-16', 'luk-p36a', 16, 42036, '{"id":"luk-p36a","sequence":36,"verseRange":"10:1-16","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 10:17-24', 'luk-p36b', 8, 42036, '{"id":"luk-p36b","sequence":36,"verseRange":"10:17-24","startChapter":10,"startVerse":17,"endChapter":10,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 10:25-37', 'luk-p37', 13, 42037, '{"id":"luk-p37","sequence":37,"verseRange":"10:25-37","startChapter":10,"startVerse":25,"endChapter":10,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 10:38-42', 'luk-p38', 5, 42038, '{"id":"luk-p38","sequence":38,"verseRange":"10:38-42","startChapter":10,"startVerse":38,"endChapter":10,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 11:1-13', 'luk-p39', 13, 42039, '{"id":"luk-p39","sequence":39,"verseRange":"11:1-13","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 11:14-32', 'luk-p40', 19, 42040, '{"id":"luk-p40","sequence":40,"verseRange":"11:14-32","startChapter":11,"startVerse":14,"endChapter":11,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 11:33-54', 'luk-p41', 22, 42041, '{"id":"luk-p41","sequence":41,"verseRange":"11:33-54","startChapter":11,"startVerse":33,"endChapter":11,"endVerse":54}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 12:1-12', 'luk-p42', 12, 42042, '{"id":"luk-p42","sequence":42,"verseRange":"12:1-12","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 12:13-21', 'luk-p43', 9, 42043, '{"id":"luk-p43","sequence":43,"verseRange":"12:13-21","startChapter":12,"startVerse":13,"endChapter":12,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 12:22-34', 'luk-p44', 13, 42044, '{"id":"luk-p44","sequence":44,"verseRange":"12:22-34","startChapter":12,"startVerse":22,"endChapter":12,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 12:35-48', 'luk-p45a', 14, 42045, '{"id":"luk-p45a","sequence":45,"verseRange":"12:35-48","startChapter":12,"startVerse":35,"endChapter":12,"endVerse":48}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 12:49-59', 'luk-p45b', 11, 42045, '{"id":"luk-p45b","sequence":45,"verseRange":"12:49-59","startChapter":12,"startVerse":49,"endChapter":12,"endVerse":59}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 13:1-9', 'luk-p46', 9, 42046, '{"id":"luk-p46","sequence":46,"verseRange":"13:1-9","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 13:10-17', 'luk-p47', 8, 42047, '{"id":"luk-p47","sequence":47,"verseRange":"13:10-17","startChapter":13,"startVerse":10,"endChapter":13,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 13:18-21', 'luk-p48', 4, 42048, '{"id":"luk-p48","sequence":48,"verseRange":"13:18-21","startChapter":13,"startVerse":18,"endChapter":13,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 13:22-30', 'luk-p49', 9, 42049, '{"id":"luk-p49","sequence":49,"verseRange":"13:22-30","startChapter":13,"startVerse":22,"endChapter":13,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 13:31-35', 'luk-p50', 5, 42050, '{"id":"luk-p50","sequence":50,"verseRange":"13:31-35","startChapter":13,"startVerse":31,"endChapter":13,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 14:1-14', 'luk-p51a', 14, 42051, '{"id":"luk-p51a","sequence":51,"verseRange":"14:1-14","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 14:15-24', 'luk-p51b', 10, 42051, '{"id":"luk-p51b","sequence":51,"verseRange":"14:15-24","startChapter":14,"startVerse":15,"endChapter":14,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 14:25-35', 'luk-p52', 11, 42052, '{"id":"luk-p52","sequence":52,"verseRange":"14:25-35","startChapter":14,"startVerse":25,"endChapter":14,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 15:1-10', 'luk-p53a', 10, 42053, '{"id":"luk-p53a","sequence":53,"verseRange":"15:1-10","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 15:11-32', 'luk-p53b', 22, 42053, '{"id":"luk-p53b","sequence":53,"verseRange":"15:11-32","startChapter":15,"startVerse":11,"endChapter":15,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 16:1-15', 'luk-p54', 15, 42054, '{"id":"luk-p54","sequence":54,"verseRange":"16:1-15","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 16:16-18', 'luk-p55', 3, 42055, '{"id":"luk-p55","sequence":55,"verseRange":"16:16-18","startChapter":16,"startVerse":16,"endChapter":16,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 16:19-31', 'luk-p56', 13, 42056, '{"id":"luk-p56","sequence":56,"verseRange":"16:19-31","startChapter":16,"startVerse":19,"endChapter":16,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 17:1-10', 'luk-p57', 10, 42057, '{"id":"luk-p57","sequence":57,"verseRange":"17:1-10","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 17:11-19', 'luk-p58', 9, 42058, '{"id":"luk-p58","sequence":58,"verseRange":"17:11-19","startChapter":17,"startVerse":11,"endChapter":17,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 17:20-37', 'luk-p59', 18, 42059, '{"id":"luk-p59","sequence":59,"verseRange":"17:20-37","startChapter":17,"startVerse":20,"endChapter":17,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 18:1-17', 'luk-p60', 17, 42060, '{"id":"luk-p60","sequence":60,"verseRange":"18:1-17","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 18:18-30', 'luk-p61', 13, 42061, '{"id":"luk-p61","sequence":61,"verseRange":"18:18-30","startChapter":18,"startVerse":18,"endChapter":18,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 18:31-34', 'luk-p62', 4, 42062, '{"id":"luk-p62","sequence":62,"verseRange":"18:31-34","startChapter":18,"startVerse":31,"endChapter":18,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 18:35-19:10', 'luk-p63', 19, 42063, '{"id":"luk-p63","sequence":63,"verseRange":"18:35-19:10","startChapter":18,"startVerse":35,"endChapter":19,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 19:11-27', 'luk-p64', 17, 42064, '{"id":"luk-p64","sequence":64,"verseRange":"19:11-27","startChapter":19,"startVerse":11,"endChapter":19,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 19:28-44', 'luk-p65', 17, 42065, '{"id":"luk-p65","sequence":65,"verseRange":"19:28-44","startChapter":19,"startVerse":28,"endChapter":19,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 19:45-20:8', 'luk-p66a', 12, 42066, '{"id":"luk-p66a","sequence":66,"verseRange":"19:45-20:8","startChapter":19,"startVerse":45,"endChapter":20,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 20:9-19', 'luk-p66b', 11, 42066, '{"id":"luk-p66b","sequence":66,"verseRange":"20:9-19","startChapter":20,"startVerse":9,"endChapter":20,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 20:20-40', 'luk-p67', 21, 42067, '{"id":"luk-p67","sequence":67,"verseRange":"20:20-40","startChapter":20,"startVerse":20,"endChapter":20,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 20:41-44', 'luk-p68', 4, 42068, '{"id":"luk-p68","sequence":68,"verseRange":"20:41-44","startChapter":20,"startVerse":41,"endChapter":20,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 20:45-21:4', 'luk-p69', 7, 42069, '{"id":"luk-p69","sequence":69,"verseRange":"20:45-21:4","startChapter":20,"startVerse":45,"endChapter":21,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 21:5-11', 'luk-p70a', 7, 42070, '{"id":"luk-p70a","sequence":70,"verseRange":"21:5-11","startChapter":21,"startVerse":5,"endChapter":21,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 21:12-19', 'luk-p70b', 8, 42070, '{"id":"luk-p70b","sequence":70,"verseRange":"21:12-19","startChapter":21,"startVerse":12,"endChapter":21,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 21:20-28', 'luk-p70c', 9, 42070, '{"id":"luk-p70c","sequence":70,"verseRange":"21:20-28","startChapter":21,"startVerse":20,"endChapter":21,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 21:29-38', 'luk-p70d', 10, 42070, '{"id":"luk-p70d","sequence":70,"verseRange":"21:29-38","startChapter":21,"startVerse":29,"endChapter":21,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 22:1-6', 'luk-p71', 6, 42071, '{"id":"luk-p71","sequence":71,"verseRange":"22:1-6","startChapter":22,"startVerse":1,"endChapter":22,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 22:7-23', 'luk-p72a', 17, 42072, '{"id":"luk-p72a","sequence":72,"verseRange":"22:7-23","startChapter":22,"startVerse":7,"endChapter":22,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 22:24-38', 'luk-p72b', 15, 42072, '{"id":"luk-p72b","sequence":72,"verseRange":"22:24-38","startChapter":22,"startVerse":24,"endChapter":22,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 22:39-46', 'luk-p73', 8, 42073, '{"id":"luk-p73","sequence":73,"verseRange":"22:39-46","startChapter":22,"startVerse":39,"endChapter":22,"endVerse":46}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 22:47-62', 'luk-p74', 16, 42074, '{"id":"luk-p74","sequence":74,"verseRange":"22:47-62","startChapter":22,"startVerse":47,"endChapter":22,"endVerse":62}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 22:63-71', 'luk-p75a', 9, 42075, '{"id":"luk-p75a","sequence":75,"verseRange":"22:63-71","startChapter":22,"startVerse":63,"endChapter":22,"endVerse":71}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 23:1-12', 'luk-p75b', 12, 42075, '{"id":"luk-p75b","sequence":75,"verseRange":"23:1-12","startChapter":23,"startVerse":1,"endChapter":23,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 23:13-25', 'luk-p75c', 13, 42075, '{"id":"luk-p75c","sequence":75,"verseRange":"23:13-25","startChapter":23,"startVerse":13,"endChapter":23,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 23:26-43', 'luk-p76a', 18, 42076, '{"id":"luk-p76a","sequence":76,"verseRange":"23:26-43","startChapter":23,"startVerse":26,"endChapter":23,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 23:44-49', 'luk-p76b', 6, 42076, '{"id":"luk-p76b","sequence":76,"verseRange":"23:44-49","startChapter":23,"startVerse":44,"endChapter":23,"endVerse":49}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 23:50-56', 'luk-p77', 7, 42077, '{"id":"luk-p77","sequence":77,"verseRange":"23:50-56","startChapter":23,"startVerse":50,"endChapter":23,"endVerse":56}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 24:1-12', 'luk-p78', 12, 42078, '{"id":"luk-p78","sequence":78,"verseRange":"24:1-12","startChapter":24,"startVerse":1,"endChapter":24,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 24:13-35', 'luk-p79', 23, 42079, '{"id":"luk-p79","sequence":79,"verseRange":"24:13-35","startChapter":24,"startVerse":13,"endChapter":24,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Luke 24:36-53', 'luk-p80', 18, 42080, '{"id":"luk-p80","sequence":80,"verseRange":"24:36-53","startChapter":24,"startVerse":36,"endChapter":24,"endVerse":53}'::jsonb);

-- John
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'John', 'jhn', 74, 43000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 1:1-5', 'jhn-p1', 5, 43001, '{"id":"jhn-p1","sequence":1,"verseRange":"1:1-5","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 1:6-18', 'jhn-p2', 13, 43002, '{"id":"jhn-p2","sequence":2,"verseRange":"1:6-18","startChapter":1,"startVerse":6,"endChapter":1,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 1:19-28', 'jhn-p3', 10, 43003, '{"id":"jhn-p3","sequence":3,"verseRange":"1:19-28","startChapter":1,"startVerse":19,"endChapter":1,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 1:29-34', 'jhn-p4', 6, 43004, '{"id":"jhn-p4","sequence":4,"verseRange":"1:29-34","startChapter":1,"startVerse":29,"endChapter":1,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 1:35-42', 'jhn-p5', 8, 43005, '{"id":"jhn-p5","sequence":5,"verseRange":"1:35-42","startChapter":1,"startVerse":35,"endChapter":1,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 1:43-51', 'jhn-p6', 9, 43006, '{"id":"jhn-p6","sequence":6,"verseRange":"1:43-51","startChapter":1,"startVerse":43,"endChapter":1,"endVerse":51}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 2:1-12', 'jhn-p7', 12, 43007, '{"id":"jhn-p7","sequence":7,"verseRange":"2:1-12","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 2:13-25', 'jhn-p8', 13, 43008, '{"id":"jhn-p8","sequence":8,"verseRange":"2:13-25","startChapter":2,"startVerse":13,"endChapter":2,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 3:1-8', 'jhn-p9', 8, 43009, '{"id":"jhn-p9","sequence":9,"verseRange":"3:1-8","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 3:9-21', 'jhn-p10', 13, 43010, '{"id":"jhn-p10","sequence":10,"verseRange":"3:9-21","startChapter":3,"startVerse":9,"endChapter":3,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 3:22-36', 'jhn-p11', 15, 43011, '{"id":"jhn-p11","sequence":11,"verseRange":"3:22-36","startChapter":3,"startVerse":22,"endChapter":3,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 4:1-15', 'jhn-p12', 15, 43012, '{"id":"jhn-p12","sequence":12,"verseRange":"4:1-15","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 4:16-26', 'jhn-p13', 11, 43013, '{"id":"jhn-p13","sequence":13,"verseRange":"4:16-26","startChapter":4,"startVerse":16,"endChapter":4,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 4:27-42', 'jhn-p14', 16, 43014, '{"id":"jhn-p14","sequence":14,"verseRange":"4:27-42","startChapter":4,"startVerse":27,"endChapter":4,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 4:43-54', 'jhn-p15', 12, 43015, '{"id":"jhn-p15","sequence":15,"verseRange":"4:43-54","startChapter":4,"startVerse":43,"endChapter":4,"endVerse":54}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 5:1-15', 'jhn-p16', 15, 43016, '{"id":"jhn-p16","sequence":16,"verseRange":"5:1-15","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 5:16-23', 'jhn-p17', 8, 43017, '{"id":"jhn-p17","sequence":17,"verseRange":"5:16-23","startChapter":5,"startVerse":16,"endChapter":5,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 5:24-30', 'jhn-p18', 7, 43018, '{"id":"jhn-p18","sequence":18,"verseRange":"5:24-30","startChapter":5,"startVerse":24,"endChapter":5,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 5:31-47', 'jhn-p19', 17, 43019, '{"id":"jhn-p19","sequence":19,"verseRange":"5:31-47","startChapter":5,"startVerse":31,"endChapter":5,"endVerse":47}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 6:1-15', 'jhn-p20', 15, 43020, '{"id":"jhn-p20","sequence":20,"verseRange":"6:1-15","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 6:16-21', 'jhn-p21', 6, 43021, '{"id":"jhn-p21","sequence":21,"verseRange":"6:16-21","startChapter":6,"startVerse":16,"endChapter":6,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 6:22-27', 'jhn-p22', 6, 43022, '{"id":"jhn-p22","sequence":22,"verseRange":"6:22-27","startChapter":6,"startVerse":22,"endChapter":6,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 6:28-40', 'jhn-p23', 13, 43023, '{"id":"jhn-p23","sequence":23,"verseRange":"6:28-40","startChapter":6,"startVerse":28,"endChapter":6,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 6:41-51', 'jhn-p24', 11, 43024, '{"id":"jhn-p24","sequence":24,"verseRange":"6:41-51","startChapter":6,"startVerse":41,"endChapter":6,"endVerse":51}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 6:52-59', 'jhn-p25', 8, 43025, '{"id":"jhn-p25","sequence":25,"verseRange":"6:52-59","startChapter":6,"startVerse":52,"endChapter":6,"endVerse":59}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 6:60-71', 'jhn-p26', 12, 43026, '{"id":"jhn-p26","sequence":26,"verseRange":"6:60-71","startChapter":6,"startVerse":60,"endChapter":6,"endVerse":71}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 7:1-10', 'jhn-p27', 10, 43027, '{"id":"jhn-p27","sequence":27,"verseRange":"7:1-10","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 7:11-24', 'jhn-p28', 14, 43028, '{"id":"jhn-p28","sequence":28,"verseRange":"7:11-24","startChapter":7,"startVerse":11,"endChapter":7,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 7:25-36', 'jhn-p29', 12, 43029, '{"id":"jhn-p29","sequence":29,"verseRange":"7:25-36","startChapter":7,"startVerse":25,"endChapter":7,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 7:37-44', 'jhn-p30', 8, 43030, '{"id":"jhn-p30","sequence":30,"verseRange":"7:37-44","startChapter":7,"startVerse":37,"endChapter":7,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 7:45-53', 'jhn-p31', 9, 43031, '{"id":"jhn-p31","sequence":31,"verseRange":"7:45-53","startChapter":7,"startVerse":45,"endChapter":7,"endVerse":53}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 8:1-11', 'jhn-p32', 11, 43032, '{"id":"jhn-p32","sequence":32,"verseRange":"8:1-11","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 8:12-20', 'jhn-p33', 9, 43033, '{"id":"jhn-p33","sequence":33,"verseRange":"8:12-20","startChapter":8,"startVerse":12,"endChapter":8,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 8:21-30', 'jhn-p34', 10, 43034, '{"id":"jhn-p34","sequence":34,"verseRange":"8:21-30","startChapter":8,"startVerse":21,"endChapter":8,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 8:31-47', 'jhn-p35', 17, 43035, '{"id":"jhn-p35","sequence":35,"verseRange":"8:31-47","startChapter":8,"startVerse":31,"endChapter":8,"endVerse":47}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 8:48-59', 'jhn-p36', 12, 43036, '{"id":"jhn-p36","sequence":36,"verseRange":"8:48-59","startChapter":8,"startVerse":48,"endChapter":8,"endVerse":59}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 9:1-12', 'jhn-p37', 12, 43037, '{"id":"jhn-p37","sequence":37,"verseRange":"9:1-12","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 9:13-23', 'jhn-p38', 11, 43038, '{"id":"jhn-p38","sequence":38,"verseRange":"9:13-23","startChapter":9,"startVerse":13,"endChapter":9,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 9:24-34', 'jhn-p39', 11, 43039, '{"id":"jhn-p39","sequence":39,"verseRange":"9:24-34","startChapter":9,"startVerse":24,"endChapter":9,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 9:35-41', 'jhn-p40', 7, 43040, '{"id":"jhn-p40","sequence":40,"verseRange":"9:35-41","startChapter":9,"startVerse":35,"endChapter":9,"endVerse":41}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 10:1-10', 'jhn-p41', 10, 43041, '{"id":"jhn-p41","sequence":41,"verseRange":"10:1-10","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 10:11-21', 'jhn-p42', 11, 43042, '{"id":"jhn-p42","sequence":42,"verseRange":"10:11-21","startChapter":10,"startVerse":11,"endChapter":10,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 10:22-42', 'jhn-p43', 21, 43043, '{"id":"jhn-p43","sequence":43,"verseRange":"10:22-42","startChapter":10,"startVerse":22,"endChapter":10,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 11:1-16', 'jhn-p44', 16, 43044, '{"id":"jhn-p44","sequence":44,"verseRange":"11:1-16","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 11:17-27', 'jhn-p45', 11, 43045, '{"id":"jhn-p45","sequence":45,"verseRange":"11:17-27","startChapter":11,"startVerse":17,"endChapter":11,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 11:28-44', 'jhn-p46', 17, 43046, '{"id":"jhn-p46","sequence":46,"verseRange":"11:28-44","startChapter":11,"startVerse":28,"endChapter":11,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 11:45-57', 'jhn-p47', 13, 43047, '{"id":"jhn-p47","sequence":47,"verseRange":"11:45-57","startChapter":11,"startVerse":45,"endChapter":11,"endVerse":57}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 12:1-11', 'jhn-p48', 11, 43048, '{"id":"jhn-p48","sequence":48,"verseRange":"12:1-11","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 12:12-19', 'jhn-p49', 8, 43049, '{"id":"jhn-p49","sequence":49,"verseRange":"12:12-19","startChapter":12,"startVerse":12,"endChapter":12,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 12:20-36', 'jhn-p50', 17, 43050, '{"id":"jhn-p50","sequence":50,"verseRange":"12:20-36","startChapter":12,"startVerse":20,"endChapter":12,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 12:37-50', 'jhn-p51', 14, 43051, '{"id":"jhn-p51","sequence":51,"verseRange":"12:37-50","startChapter":12,"startVerse":37,"endChapter":12,"endVerse":50}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 13:1-11', 'jhn-p52', 11, 43052, '{"id":"jhn-p52","sequence":52,"verseRange":"13:1-11","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 13:12-30', 'jhn-p53', 19, 43053, '{"id":"jhn-p53","sequence":53,"verseRange":"13:12-30","startChapter":13,"startVerse":12,"endChapter":13,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 13:31-38', 'jhn-p54', 8, 43054, '{"id":"jhn-p54","sequence":54,"verseRange":"13:31-38","startChapter":13,"startVerse":31,"endChapter":13,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 14:1-14', 'jhn-p55', 14, 43055, '{"id":"jhn-p55","sequence":55,"verseRange":"14:1-14","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 14:15-21', 'jhn-p56', 7, 43056, '{"id":"jhn-p56","sequence":56,"verseRange":"14:15-21","startChapter":14,"startVerse":15,"endChapter":14,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 14:22-31', 'jhn-p57', 10, 43057, '{"id":"jhn-p57","sequence":57,"verseRange":"14:22-31","startChapter":14,"startVerse":22,"endChapter":14,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 15:1-17', 'jhn-p58', 17, 43058, '{"id":"jhn-p58","sequence":58,"verseRange":"15:1-17","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 15:18-27', 'jhn-p59', 10, 43059, '{"id":"jhn-p59","sequence":59,"verseRange":"15:18-27","startChapter":15,"startVerse":18,"endChapter":15,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 16:1-15', 'jhn-p60', 15, 43060, '{"id":"jhn-p60","sequence":60,"verseRange":"16:1-15","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 16:16-24', 'jhn-p61', 9, 43061, '{"id":"jhn-p61","sequence":61,"verseRange":"16:16-24","startChapter":16,"startVerse":16,"endChapter":16,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 16:25-33', 'jhn-p62', 9, 43062, '{"id":"jhn-p62","sequence":62,"verseRange":"16:25-33","startChapter":16,"startVerse":25,"endChapter":16,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 17:1-19', 'jhn-p63', 19, 43063, '{"id":"jhn-p63","sequence":63,"verseRange":"17:1-19","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 17:20-26', 'jhn-p64', 7, 43064, '{"id":"jhn-p64","sequence":64,"verseRange":"17:20-26","startChapter":17,"startVerse":20,"endChapter":17,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 18:1-14', 'jhn-p65', 14, 43065, '{"id":"jhn-p65","sequence":65,"verseRange":"18:1-14","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 18:15-27', 'jhn-p66', 13, 43066, '{"id":"jhn-p66","sequence":66,"verseRange":"18:15-27","startChapter":18,"startVerse":15,"endChapter":18,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 18:28-40', 'jhn-p67', 13, 43067, '{"id":"jhn-p67","sequence":67,"verseRange":"18:28-40","startChapter":18,"startVerse":28,"endChapter":18,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 19:1-16', 'jhn-p68', 16, 43068, '{"id":"jhn-p68","sequence":68,"verseRange":"19:1-16","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 19:17-30', 'jhn-p69', 14, 43069, '{"id":"jhn-p69","sequence":69,"verseRange":"19:17-30","startChapter":19,"startVerse":17,"endChapter":19,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 19:31-42', 'jhn-p70', 12, 43070, '{"id":"jhn-p70","sequence":70,"verseRange":"19:31-42","startChapter":19,"startVerse":31,"endChapter":19,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 20:1-18', 'jhn-p71', 18, 43071, '{"id":"jhn-p71","sequence":71,"verseRange":"20:1-18","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 20:19-31', 'jhn-p72', 13, 43072, '{"id":"jhn-p72","sequence":72,"verseRange":"20:19-31","startChapter":20,"startVerse":19,"endChapter":20,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 21:1-14', 'jhn-p73', 14, 43073, '{"id":"jhn-p73","sequence":73,"verseRange":"21:1-14","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'John 21:15-25', 'jhn-p74', 11, 43074, '{"id":"jhn-p74","sequence":74,"verseRange":"21:15-25","startChapter":21,"startVerse":15,"endChapter":21,"endVerse":25}'::jsonb);

-- Acts
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Acts', 'act', 95, 44000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 1:1-5', 'act-p1a', 5, 44001, '{"id":"act-p1a","sequence":1,"verseRange":"1:1-5","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 1:6-11', 'act-p1b', 6, 44001, '{"id":"act-p1b","sequence":1,"verseRange":"1:6-11","startChapter":1,"startVerse":6,"endChapter":1,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 1:12-14', 'act-p2', 3, 44002, '{"id":"act-p2","sequence":2,"verseRange":"1:12-14","startChapter":1,"startVerse":12,"endChapter":1,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 1:15-26', 'act-p3', 12, 44003, '{"id":"act-p3","sequence":3,"verseRange":"1:15-26","startChapter":1,"startVerse":15,"endChapter":1,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 2:1-13', 'act-p4', 13, 44004, '{"id":"act-p4","sequence":4,"verseRange":"2:1-13","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 2:14-36', 'act-p5a', 23, 44005, '{"id":"act-p5a","sequence":5,"verseRange":"2:14-36","startChapter":2,"startVerse":14,"endChapter":2,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 2:37-41', 'act-p5b', 5, 44005, '{"id":"act-p5b","sequence":5,"verseRange":"2:37-41","startChapter":2,"startVerse":37,"endChapter":2,"endVerse":41}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 2:41-47', 'act-p6', 7, 44006, '{"id":"act-p6","sequence":6,"verseRange":"2:41-47","startChapter":2,"startVerse":41,"endChapter":2,"endVerse":47}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 3:1-10', 'act-p7', 10, 44007, '{"id":"act-p7","sequence":7,"verseRange":"3:1-10","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 3:11-26', 'act-p8', 16, 44008, '{"id":"act-p8","sequence":8,"verseRange":"3:11-26","startChapter":3,"startVerse":11,"endChapter":3,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 4:1-22', 'act-p9', 22, 44009, '{"id":"act-p9","sequence":9,"verseRange":"4:1-22","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 4:23-31', 'act-p10', 9, 44010, '{"id":"act-p10","sequence":10,"verseRange":"4:23-31","startChapter":4,"startVerse":23,"endChapter":4,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 4:32-37', 'act-p11', 6, 44011, '{"id":"act-p11","sequence":11,"verseRange":"4:32-37","startChapter":4,"startVerse":32,"endChapter":4,"endVerse":37}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 5:1-11', 'act-p12', 11, 44012, '{"id":"act-p12","sequence":12,"verseRange":"5:1-11","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 5:12-16', 'act-p13', 5, 44013, '{"id":"act-p13","sequence":13,"verseRange":"5:12-16","startChapter":5,"startVerse":12,"endChapter":5,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 5:17-26', 'act-p14a', 10, 44014, '{"id":"act-p14a","sequence":14,"verseRange":"5:17-26","startChapter":5,"startVerse":17,"endChapter":5,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 5:27-42', 'act-p14b', 16, 44014, '{"id":"act-p14b","sequence":14,"verseRange":"5:27-42","startChapter":5,"startVerse":27,"endChapter":5,"endVerse":42}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 6:1-7', 'act-p15', 7, 44015, '{"id":"act-p15","sequence":15,"verseRange":"6:1-7","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 6:8-15', 'act-p16', 8, 44016, '{"id":"act-p16","sequence":16,"verseRange":"6:8-15","startChapter":6,"startVerse":8,"endChapter":6,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 7:1-8', 'act-p17a', 8, 44017, '{"id":"act-p17a","sequence":17,"verseRange":"7:1-8","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 7:9-19', 'act-p17b', 11, 44017, '{"id":"act-p17b","sequence":17,"verseRange":"7:9-19","startChapter":7,"startVerse":9,"endChapter":7,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 7:20-34', 'act-p17c', 15, 44017, '{"id":"act-p17c","sequence":17,"verseRange":"7:20-34","startChapter":7,"startVerse":20,"endChapter":7,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 7:35-43', 'act-p18a', 9, 44018, '{"id":"act-p18a","sequence":18,"verseRange":"7:35-43","startChapter":7,"startVerse":35,"endChapter":7,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 7:44-53', 'act-p18b', 10, 44018, '{"id":"act-p18b","sequence":18,"verseRange":"7:44-53","startChapter":7,"startVerse":44,"endChapter":7,"endVerse":53}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 7:54-8:3', 'act-p19', 10, 44019, '{"id":"act-p19","sequence":19,"verseRange":"7:54-8:3","startChapter":7,"startVerse":54,"endChapter":8,"endVerse":3}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 8:4-25', 'act-p20', 22, 44020, '{"id":"act-p20","sequence":20,"verseRange":"8:4-25","startChapter":8,"startVerse":4,"endChapter":8,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 8:26-40', 'act-p21', 15, 44021, '{"id":"act-p21","sequence":21,"verseRange":"8:26-40","startChapter":8,"startVerse":26,"endChapter":8,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 9:1-19a', 'act-p22a', 19, 44022, '{"id":"act-p22a","sequence":22,"verseRange":"9:1-19a","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 9:19b-31', 'act-p22b', 13, 44022, '{"id":"act-p22b","sequence":22,"verseRange":"9:19b-31","startChapter":9,"startVerse":19,"endChapter":9,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 9:32-35', 'act-p23', 4, 44023, '{"id":"act-p23","sequence":23,"verseRange":"9:32-35","startChapter":9,"startVerse":32,"endChapter":9,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 9:36-43', 'act-p24', 8, 44024, '{"id":"act-p24","sequence":24,"verseRange":"9:36-43","startChapter":9,"startVerse":36,"endChapter":9,"endVerse":43}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 10:1-8', 'act-p25a', 8, 44025, '{"id":"act-p25a","sequence":25,"verseRange":"10:1-8","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 10:9-23a', 'act-p25b', 15, 44025, '{"id":"act-p25b","sequence":25,"verseRange":"10:9-23a","startChapter":10,"startVerse":9,"endChapter":10,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 10:23b-33', 'act-p25c', 11, 44025, '{"id":"act-p25c","sequence":25,"verseRange":"10:23b-33","startChapter":10,"startVerse":23,"endChapter":10,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 10:34-48', 'act-p25d', 15, 44025, '{"id":"act-p25d","sequence":25,"verseRange":"10:34-48","startChapter":10,"startVerse":34,"endChapter":10,"endVerse":48}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 11:1-18', 'act-p26', 18, 44026, '{"id":"act-p26","sequence":26,"verseRange":"11:1-18","startChapter":11,"startVerse":1,"endChapter":11,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 11:19-26', 'act-p27', 8, 44027, '{"id":"act-p27","sequence":27,"verseRange":"11:19-26","startChapter":11,"startVerse":19,"endChapter":11,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 11:27-30', 'act-p28', 4, 44028, '{"id":"act-p28","sequence":28,"verseRange":"11:27-30","startChapter":11,"startVerse":27,"endChapter":11,"endVerse":30}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 12:1-5', 'act-p29', 5, 44029, '{"id":"act-p29","sequence":29,"verseRange":"12:1-5","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 12:6-19', 'act-p30', 14, 44030, '{"id":"act-p30","sequence":30,"verseRange":"12:6-19","startChapter":12,"startVerse":6,"endChapter":12,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 12:20-24', 'act-p31', 5, 44031, '{"id":"act-p31","sequence":31,"verseRange":"12:20-24","startChapter":12,"startVerse":20,"endChapter":12,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 12:25-13:3', 'act-p32', 4, 44032, '{"id":"act-p32","sequence":32,"verseRange":"12:25-13:3","startChapter":12,"startVerse":25,"endChapter":13,"endVerse":3}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 13:4-12', 'act-p33', 9, 44033, '{"id":"act-p33","sequence":33,"verseRange":"13:4-12","startChapter":13,"startVerse":4,"endChapter":13,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 13:13-22', 'act-p34', 10, 44034, '{"id":"act-p34","sequence":34,"verseRange":"13:13-22","startChapter":13,"startVerse":13,"endChapter":13,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 13:23-41', 'act-p35a', 19, 44035, '{"id":"act-p35a","sequence":35,"verseRange":"13:23-41","startChapter":13,"startVerse":23,"endChapter":13,"endVerse":41}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 13:42-52', 'act-p35b', 11, 44035, '{"id":"act-p35b","sequence":35,"verseRange":"13:42-52","startChapter":13,"startVerse":42,"endChapter":13,"endVerse":52}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 14:1-7', 'act-p36', 7, 44036, '{"id":"act-p36","sequence":36,"verseRange":"14:1-7","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 14:8-20', 'act-p37', 13, 44037, '{"id":"act-p37","sequence":37,"verseRange":"14:8-20","startChapter":14,"startVerse":8,"endChapter":14,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 14:21-28', 'act-p38', 8, 44038, '{"id":"act-p38","sequence":38,"verseRange":"14:21-28","startChapter":14,"startVerse":21,"endChapter":14,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 15:1-21', 'act-p39a', 21, 44039, '{"id":"act-p39a","sequence":39,"verseRange":"15:1-21","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 15:22-35', 'act-p39b', 14, 44039, '{"id":"act-p39b","sequence":39,"verseRange":"15:22-35","startChapter":15,"startVerse":22,"endChapter":15,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 15:36-41', 'act-p40', 6, 44040, '{"id":"act-p40","sequence":40,"verseRange":"15:36-41","startChapter":15,"startVerse":36,"endChapter":15,"endVerse":41}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 16:1-5', 'act-p41a', 5, 44041, '{"id":"act-p41a","sequence":41,"verseRange":"16:1-5","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 16:6-15', 'act-p41b', 10, 44041, '{"id":"act-p41b","sequence":41,"verseRange":"16:6-15","startChapter":16,"startVerse":6,"endChapter":16,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 16:16-24', 'act-p41c', 9, 44041, '{"id":"act-p41c","sequence":41,"verseRange":"16:16-24","startChapter":16,"startVerse":16,"endChapter":16,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 16:25-40', 'act-p41d', 16, 44041, '{"id":"act-p41d","sequence":41,"verseRange":"16:25-40","startChapter":16,"startVerse":25,"endChapter":16,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 17:1-9', 'act-p42', 9, 44042, '{"id":"act-p42","sequence":42,"verseRange":"17:1-9","startChapter":17,"startVerse":1,"endChapter":17,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 17:10-15', 'act-p43', 6, 44043, '{"id":"act-p43","sequence":43,"verseRange":"17:10-15","startChapter":17,"startVerse":10,"endChapter":17,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 17:16-21', 'act-p44a', 6, 44044, '{"id":"act-p44a","sequence":44,"verseRange":"17:16-21","startChapter":17,"startVerse":16,"endChapter":17,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 17:22-34', 'act-p44b', 13, 44044, '{"id":"act-p44b","sequence":44,"verseRange":"17:22-34","startChapter":17,"startVerse":22,"endChapter":17,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 18:1-17', 'act-p45', 17, 44045, '{"id":"act-p45","sequence":45,"verseRange":"18:1-17","startChapter":18,"startVerse":1,"endChapter":18,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 18:18-23', 'act-p46', 6, 44046, '{"id":"act-p46","sequence":46,"verseRange":"18:18-23","startChapter":18,"startVerse":18,"endChapter":18,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 18:24-28', 'act-p47', 5, 44047, '{"id":"act-p47","sequence":47,"verseRange":"18:24-28","startChapter":18,"startVerse":24,"endChapter":18,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 19:1-7', 'act-p48', 7, 44048, '{"id":"act-p48","sequence":48,"verseRange":"19:1-7","startChapter":19,"startVerse":1,"endChapter":19,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 19:8-10', 'act-p49', 3, 44049, '{"id":"act-p49","sequence":49,"verseRange":"19:8-10","startChapter":19,"startVerse":8,"endChapter":19,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 19:11-20', 'act-p50', 10, 44050, '{"id":"act-p50","sequence":50,"verseRange":"19:11-20","startChapter":19,"startVerse":11,"endChapter":19,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 19:21-41', 'act-p51', 21, 44051, '{"id":"act-p51","sequence":51,"verseRange":"19:21-41","startChapter":19,"startVerse":21,"endChapter":19,"endVerse":41}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 20:1-6', 'act-p52', 6, 44052, '{"id":"act-p52","sequence":52,"verseRange":"20:1-6","startChapter":20,"startVerse":1,"endChapter":20,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 20:7-12', 'act-p53', 6, 44053, '{"id":"act-p53","sequence":53,"verseRange":"20:7-12","startChapter":20,"startVerse":7,"endChapter":20,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 20:13-17', 'act-p54', 5, 44054, '{"id":"act-p54","sequence":54,"verseRange":"20:13-17","startChapter":20,"startVerse":13,"endChapter":20,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 20:18-38', 'act-p55', 21, 44055, '{"id":"act-p55","sequence":55,"verseRange":"20:18-38","startChapter":20,"startVerse":18,"endChapter":20,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 21:1-9', 'act-p56', 9, 44056, '{"id":"act-p56","sequence":56,"verseRange":"21:1-9","startChapter":21,"startVerse":1,"endChapter":21,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 21:10-14', 'act-p57', 5, 44057, '{"id":"act-p57","sequence":57,"verseRange":"21:10-14","startChapter":21,"startVerse":10,"endChapter":21,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 21:15-26', 'act-p58', 12, 44058, '{"id":"act-p58","sequence":58,"verseRange":"21:15-26","startChapter":21,"startVerse":15,"endChapter":21,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 21:27-36', 'act-p59', 10, 44059, '{"id":"act-p59","sequence":59,"verseRange":"21:27-36","startChapter":21,"startVerse":27,"endChapter":21,"endVerse":36}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 21:37-22:21', 'act-p60', 25, 44060, '{"id":"act-p60","sequence":60,"verseRange":"21:37-22:21","startChapter":21,"startVerse":37,"endChapter":22,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 22:22-29', 'act-p61', 8, 44061, '{"id":"act-p61","sequence":61,"verseRange":"22:22-29","startChapter":22,"startVerse":22,"endChapter":22,"endVerse":29}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 22:30-23:11', 'act-p62', 12, 44062, '{"id":"act-p62","sequence":62,"verseRange":"22:30-23:11","startChapter":22,"startVerse":30,"endChapter":23,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 23:12-35', 'act-p63', 24, 44063, '{"id":"act-p63","sequence":63,"verseRange":"23:12-35","startChapter":23,"startVerse":12,"endChapter":23,"endVerse":35}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 24:1-9', 'act-p64', 9, 44064, '{"id":"act-p64","sequence":64,"verseRange":"24:1-9","startChapter":24,"startVerse":1,"endChapter":24,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 24:10-23', 'act-p65', 14, 44065, '{"id":"act-p65","sequence":65,"verseRange":"24:10-23","startChapter":24,"startVerse":10,"endChapter":24,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 24:24-27', 'act-p66', 4, 44066, '{"id":"act-p66","sequence":66,"verseRange":"24:24-27","startChapter":24,"startVerse":24,"endChapter":24,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 25:1-5', 'act-p67', 5, 44067, '{"id":"act-p67","sequence":67,"verseRange":"25:1-5","startChapter":25,"startVerse":1,"endChapter":25,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 25:6-12', 'act-p68', 7, 44068, '{"id":"act-p68","sequence":68,"verseRange":"25:6-12","startChapter":25,"startVerse":6,"endChapter":25,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 25:13-22', 'act-p69', 10, 44069, '{"id":"act-p69","sequence":69,"verseRange":"25:13-22","startChapter":25,"startVerse":13,"endChapter":25,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 25:23-27', 'act-p70', 5, 44070, '{"id":"act-p70","sequence":70,"verseRange":"25:23-27","startChapter":25,"startVerse":23,"endChapter":25,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 26:1-23', 'act-p71a', 23, 44071, '{"id":"act-p71a","sequence":71,"verseRange":"26:1-23","startChapter":26,"startVerse":1,"endChapter":26,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 26:24-32', 'act-p71b', 9, 44071, '{"id":"act-p71b","sequence":71,"verseRange":"26:24-32","startChapter":26,"startVerse":24,"endChapter":26,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 27:1-8', 'act-p72', 8, 44072, '{"id":"act-p72","sequence":72,"verseRange":"27:1-8","startChapter":27,"startVerse":1,"endChapter":27,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 27:9-26', 'act-p73a', 18, 44073, '{"id":"act-p73a","sequence":73,"verseRange":"27:9-26","startChapter":27,"startVerse":9,"endChapter":27,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 27:27-38', 'act-p73b', 12, 44073, '{"id":"act-p73b","sequence":73,"verseRange":"27:27-38","startChapter":27,"startVerse":27,"endChapter":27,"endVerse":38}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 27:39-44', 'act-p74', 6, 44074, '{"id":"act-p74","sequence":74,"verseRange":"27:39-44","startChapter":27,"startVerse":39,"endChapter":27,"endVerse":44}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 28:1-10', 'act-p75', 10, 44075, '{"id":"act-p75","sequence":75,"verseRange":"28:1-10","startChapter":28,"startVerse":1,"endChapter":28,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 28:11-16', 'act-p76', 6, 44076, '{"id":"act-p76","sequence":76,"verseRange":"28:11-16","startChapter":28,"startVerse":11,"endChapter":28,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Acts 28:17-31', 'act-p77', 15, 44077, '{"id":"act-p77","sequence":77,"verseRange":"28:17-31","startChapter":28,"startVerse":17,"endChapter":28,"endVerse":31}'::jsonb);

-- Romans
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Romans', 'rom', 0, 45000, NULL
);

-- 1 Corinthians
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '1 Corinthians', '1co', 52, 46000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 1:1-9', '1co-p1', 9, 46001, '{"id":"1co-p1","sequence":1,"verseRange":"1:1-9","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 1:10-17', '1co-p2', 8, 46002, '{"id":"1co-p2","sequence":2,"verseRange":"1:10-17","startChapter":1,"startVerse":10,"endChapter":1,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 1:18-25', '1co-p3', 8, 46003, '{"id":"1co-p3","sequence":3,"verseRange":"1:18-25","startChapter":1,"startVerse":18,"endChapter":1,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 1:26-31', '1co-p4', 6, 46004, '{"id":"1co-p4","sequence":4,"verseRange":"1:26-31","startChapter":1,"startVerse":26,"endChapter":1,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 2:1-5', '1co-p5', 5, 46005, '{"id":"1co-p5","sequence":5,"verseRange":"2:1-5","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 2:6-16', '1co-p6', 11, 46006, '{"id":"1co-p6","sequence":6,"verseRange":"2:6-16","startChapter":2,"startVerse":6,"endChapter":2,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 3:1-4', '1co-p7', 4, 46007, '{"id":"1co-p7","sequence":7,"verseRange":"3:1-4","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 3:5-9', '1co-p8', 5, 46008, '{"id":"1co-p8","sequence":8,"verseRange":"3:5-9","startChapter":3,"startVerse":5,"endChapter":3,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 3:10-17', '1co-p9', 8, 46009, '{"id":"1co-p9","sequence":9,"verseRange":"3:10-17","startChapter":3,"startVerse":10,"endChapter":3,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 3:18-23', '1co-p10', 6, 46010, '{"id":"1co-p10","sequence":10,"verseRange":"3:18-23","startChapter":3,"startVerse":18,"endChapter":3,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 4:1-5', '1co-p11', 5, 46011, '{"id":"1co-p11","sequence":11,"verseRange":"4:1-5","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 4:6-13', '1co-p12', 8, 46012, '{"id":"1co-p12","sequence":12,"verseRange":"4:6-13","startChapter":4,"startVerse":6,"endChapter":4,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 4:14-21', '1co-p13', 8, 46013, '{"id":"1co-p13","sequence":13,"verseRange":"4:14-21","startChapter":4,"startVerse":14,"endChapter":4,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 5:1-13', '1co-p14', 13, 46014, '{"id":"1co-p14","sequence":14,"verseRange":"5:1-13","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 6:1-11', '1co-p15', 11, 46015, '{"id":"1co-p15","sequence":15,"verseRange":"6:1-11","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 6:12-20', '1co-p16', 9, 46016, '{"id":"1co-p16","sequence":16,"verseRange":"6:12-20","startChapter":6,"startVerse":12,"endChapter":6,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 7:1-9', '1co-p17', 9, 46017, '{"id":"1co-p17","sequence":17,"verseRange":"7:1-9","startChapter":7,"startVerse":1,"endChapter":7,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 7:10-16', '1co-p18', 7, 46018, '{"id":"1co-p18","sequence":18,"verseRange":"7:10-16","startChapter":7,"startVerse":10,"endChapter":7,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 7:17-24', '1co-p19', 8, 46019, '{"id":"1co-p19","sequence":19,"verseRange":"7:17-24","startChapter":7,"startVerse":17,"endChapter":7,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 7:25-31', '1co-p20', 7, 46020, '{"id":"1co-p20","sequence":20,"verseRange":"7:25-31","startChapter":7,"startVerse":25,"endChapter":7,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 7:32-40', '1co-p21', 9, 46021, '{"id":"1co-p21","sequence":21,"verseRange":"7:32-40","startChapter":7,"startVerse":32,"endChapter":7,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 8:1-13', '1co-p22', 13, 46022, '{"id":"1co-p22","sequence":22,"verseRange":"8:1-13","startChapter":8,"startVerse":1,"endChapter":8,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 9:1-14', '1co-p23', 14, 46023, '{"id":"1co-p23","sequence":23,"verseRange":"9:1-14","startChapter":9,"startVerse":1,"endChapter":9,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 9:15-23', '1co-p24', 9, 46024, '{"id":"1co-p24","sequence":24,"verseRange":"9:15-23","startChapter":9,"startVerse":15,"endChapter":9,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 9:24-27', '1co-p25', 4, 46025, '{"id":"1co-p25","sequence":25,"verseRange":"9:24-27","startChapter":9,"startVerse":24,"endChapter":9,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 10:1-13', '1co-p26', 13, 46026, '{"id":"1co-p26","sequence":26,"verseRange":"10:1-13","startChapter":10,"startVerse":1,"endChapter":10,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 10:14-22', '1co-p27', 9, 46027, '{"id":"1co-p27","sequence":27,"verseRange":"10:14-22","startChapter":10,"startVerse":14,"endChapter":10,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 10:23-11:1', '1co-p28', 12, 46028, '{"id":"1co-p28","sequence":28,"verseRange":"10:23-11:1","startChapter":10,"startVerse":23,"endChapter":11,"endVerse":1}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 11:2-16', '1co-p29', 15, 46029, '{"id":"1co-p29","sequence":29,"verseRange":"11:2-16","startChapter":11,"startVerse":2,"endChapter":11,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 11:17-26', '1co-p30', 10, 46030, '{"id":"1co-p30","sequence":30,"verseRange":"11:17-26","startChapter":11,"startVerse":17,"endChapter":11,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 11:27-34', '1co-p31', 8, 46031, '{"id":"1co-p31","sequence":31,"verseRange":"11:27-34","startChapter":11,"startVerse":27,"endChapter":11,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 12:1-11', '1co-p32', 11, 46032, '{"id":"1co-p32","sequence":32,"verseRange":"12:1-11","startChapter":12,"startVerse":1,"endChapter":12,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 12:12-26', '1co-p33', 15, 46033, '{"id":"1co-p33","sequence":33,"verseRange":"12:12-26","startChapter":12,"startVerse":12,"endChapter":12,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 12:27-31', '1co-p34', 5, 46034, '{"id":"1co-p34","sequence":34,"verseRange":"12:27-31","startChapter":12,"startVerse":27,"endChapter":12,"endVerse":31}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 13:1-7', '1co-p35', 7, 46035, '{"id":"1co-p35","sequence":35,"verseRange":"13:1-7","startChapter":13,"startVerse":1,"endChapter":13,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 13:8-13', '1co-p36', 6, 46036, '{"id":"1co-p36","sequence":36,"verseRange":"13:8-13","startChapter":13,"startVerse":8,"endChapter":13,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 14:1-5', '1co-p37', 5, 46037, '{"id":"1co-p37","sequence":37,"verseRange":"14:1-5","startChapter":14,"startVerse":1,"endChapter":14,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 14:6-19', '1co-p38', 14, 46038, '{"id":"1co-p38","sequence":38,"verseRange":"14:6-19","startChapter":14,"startVerse":6,"endChapter":14,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 14:20-25', '1co-p39', 6, 46039, '{"id":"1co-p39","sequence":39,"verseRange":"14:20-25","startChapter":14,"startVerse":20,"endChapter":14,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 14:26-33', '1co-p40', 8, 46040, '{"id":"1co-p40","sequence":40,"verseRange":"14:26-33","startChapter":14,"startVerse":26,"endChapter":14,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 14:34-40', '1co-p41', 7, 46041, '{"id":"1co-p41","sequence":41,"verseRange":"14:34-40","startChapter":14,"startVerse":34,"endChapter":14,"endVerse":40}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 15:1-11', '1co-p42', 11, 46042, '{"id":"1co-p42","sequence":42,"verseRange":"15:1-11","startChapter":15,"startVerse":1,"endChapter":15,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 15:12-19', '1co-p43', 8, 46043, '{"id":"1co-p43","sequence":43,"verseRange":"15:12-19","startChapter":15,"startVerse":12,"endChapter":15,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 15:20-28', '1co-p44', 9, 46044, '{"id":"1co-p44","sequence":44,"verseRange":"15:20-28","startChapter":15,"startVerse":20,"endChapter":15,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 15:29-34', '1co-p45', 6, 46045, '{"id":"1co-p45","sequence":45,"verseRange":"15:29-34","startChapter":15,"startVerse":29,"endChapter":15,"endVerse":34}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 15:35-41', '1co-p46', 7, 46046, '{"id":"1co-p46","sequence":46,"verseRange":"15:35-41","startChapter":15,"startVerse":35,"endChapter":15,"endVerse":41}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 15:42-49', '1co-p47', 8, 46047, '{"id":"1co-p47","sequence":47,"verseRange":"15:42-49","startChapter":15,"startVerse":42,"endChapter":15,"endVerse":49}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 15:50-58', '1co-p48', 9, 46048, '{"id":"1co-p48","sequence":48,"verseRange":"15:50-58","startChapter":15,"startVerse":50,"endChapter":15,"endVerse":58}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 16:1-4', '1co-p49', 4, 46049, '{"id":"1co-p49","sequence":49,"verseRange":"16:1-4","startChapter":16,"startVerse":1,"endChapter":16,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 16:5-12', '1co-p50', 8, 46050, '{"id":"1co-p50","sequence":50,"verseRange":"16:5-12","startChapter":16,"startVerse":5,"endChapter":16,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 16:13-18', '1co-p51', 6, 46051, '{"id":"1co-p51","sequence":51,"verseRange":"16:13-18","startChapter":16,"startVerse":13,"endChapter":16,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Corinthians 16:19-24', '1co-p52', 6, 46052, '{"id":"1co-p52","sequence":52,"verseRange":"16:19-24","startChapter":16,"startVerse":19,"endChapter":16,"endVerse":24}'::jsonb);

-- 2 Corinthians
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', '2 Corinthians', '2co', 0, 47000, NULL
);

-- Galatians
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Galatians', 'gal', 20, 48000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 1:1-5', 'gal-p1', 5, 48001, '{"id":"gal-p1","sequence":1,"verseRange":"1:1-5","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 1:6-10', 'gal-p2', 5, 48002, '{"id":"gal-p2","sequence":2,"verseRange":"1:6-10","startChapter":1,"startVerse":6,"endChapter":1,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 1:11-24', 'gal-p3', 14, 48003, '{"id":"gal-p3","sequence":3,"verseRange":"1:11-24","startChapter":1,"startVerse":11,"endChapter":1,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 2:1-10', 'gal-p4', 10, 48004, '{"id":"gal-p4","sequence":4,"verseRange":"2:1-10","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 2:11-14', 'gal-p5', 4, 48005, '{"id":"gal-p5","sequence":5,"verseRange":"2:11-14","startChapter":2,"startVerse":11,"endChapter":2,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 2:15-21', 'gal-p6', 7, 48006, '{"id":"gal-p6","sequence":6,"verseRange":"2:15-21","startChapter":2,"startVerse":15,"endChapter":2,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 3:1-9', 'gal-p7', 9, 48007, '{"id":"gal-p7","sequence":7,"verseRange":"3:1-9","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 3:10-14', 'gal-p8', 5, 48008, '{"id":"gal-p8","sequence":8,"verseRange":"3:10-14","startChapter":3,"startVerse":10,"endChapter":3,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 3:15-18', 'gal-p9', 4, 48009, '{"id":"gal-p9","sequence":9,"verseRange":"3:15-18","startChapter":3,"startVerse":15,"endChapter":3,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 3:19-25', 'gal-p10', 7, 48010, '{"id":"gal-p10","sequence":10,"verseRange":"3:19-25","startChapter":3,"startVerse":19,"endChapter":3,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 3:26-4:7', 'gal-p11', 11, 48011, '{"id":"gal-p11","sequence":11,"verseRange":"3:26-4:7","startChapter":3,"startVerse":26,"endChapter":4,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 4:8-20', 'gal-p12', 13, 48012, '{"id":"gal-p12","sequence":12,"verseRange":"4:8-20","startChapter":4,"startVerse":8,"endChapter":4,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 4:21-27', 'gal-p13', 7, 48013, '{"id":"gal-p13","sequence":13,"verseRange":"4:21-27","startChapter":4,"startVerse":21,"endChapter":4,"endVerse":27}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 4:28-5:1', 'gal-p14', 5, 48014, '{"id":"gal-p14","sequence":14,"verseRange":"4:28-5:1","startChapter":4,"startVerse":28,"endChapter":5,"endVerse":1}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 5:2-6', 'gal-p15', 5, 48015, '{"id":"gal-p15","sequence":15,"verseRange":"5:2-6","startChapter":5,"startVerse":2,"endChapter":5,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 5:7-12', 'gal-p16', 6, 48016, '{"id":"gal-p16","sequence":16,"verseRange":"5:7-12","startChapter":5,"startVerse":7,"endChapter":5,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 5:13-18', 'gal-p17', 6, 48017, '{"id":"gal-p17","sequence":17,"verseRange":"5:13-18","startChapter":5,"startVerse":13,"endChapter":5,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 5:19-26', 'gal-p18', 8, 48018, '{"id":"gal-p18","sequence":18,"verseRange":"5:19-26","startChapter":5,"startVerse":19,"endChapter":5,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 6:1-10', 'gal-p19', 10, 48019, '{"id":"gal-p19","sequence":19,"verseRange":"6:1-10","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Galatians 6:11-18', 'gal-p20', 8, 48020, '{"id":"gal-p20","sequence":20,"verseRange":"6:11-18","startChapter":6,"startVerse":11,"endChapter":6,"endVerse":18}'::jsonb);

-- Ephesians
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Ephesians', 'eph', 21, 49000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 1:1-6', 'eph-p1', 6, 49001, '{"id":"eph-p1","sequence":1,"verseRange":"1:1-6","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 1:7-10', 'eph-p2a', 4, 49002, '{"id":"eph-p2a","sequence":2,"verseRange":"1:7-10","startChapter":1,"startVerse":7,"endChapter":1,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 1:11-14', 'eph-p2b', 4, 49002, '{"id":"eph-p2b","sequence":2,"verseRange":"1:11-14","startChapter":1,"startVerse":11,"endChapter":1,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 1:15-23', 'eph-p3', 9, 49003, '{"id":"eph-p3","sequence":3,"verseRange":"1:15-23","startChapter":1,"startVerse":15,"endChapter":1,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 2:1-10', 'eph-p4', 10, 49004, '{"id":"eph-p4","sequence":4,"verseRange":"2:1-10","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 2:11-18', 'eph-p5', 8, 49005, '{"id":"eph-p5","sequence":5,"verseRange":"2:11-18","startChapter":2,"startVerse":11,"endChapter":2,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 2:19-22', 'eph-p6', 4, 49006, '{"id":"eph-p6","sequence":6,"verseRange":"2:19-22","startChapter":2,"startVerse":19,"endChapter":2,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 3:1-6', 'eph-p7', 6, 49007, '{"id":"eph-p7","sequence":7,"verseRange":"3:1-6","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 3:7-13', 'eph-p8', 7, 49008, '{"id":"eph-p8","sequence":8,"verseRange":"3:7-13","startChapter":3,"startVerse":7,"endChapter":3,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 3:14-21', 'eph-p9', 8, 49009, '{"id":"eph-p9","sequence":9,"verseRange":"3:14-21","startChapter":3,"startVerse":14,"endChapter":3,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 4:1-6', 'eph-p10', 6, 49010, '{"id":"eph-p10","sequence":10,"verseRange":"4:1-6","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 4:7-16', 'eph-p11', 10, 49011, '{"id":"eph-p11","sequence":11,"verseRange":"4:7-16","startChapter":4,"startVerse":7,"endChapter":4,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 4:17-24', 'eph-p12', 8, 49012, '{"id":"eph-p12","sequence":12,"verseRange":"4:17-24","startChapter":4,"startVerse":17,"endChapter":4,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 4:25-32', 'eph-p13', 8, 49013, '{"id":"eph-p13","sequence":13,"verseRange":"4:25-32","startChapter":4,"startVerse":25,"endChapter":4,"endVerse":32}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 5:1-6', 'eph-p14', 6, 49014, '{"id":"eph-p14","sequence":14,"verseRange":"5:1-6","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 5:7-14', 'eph-p15', 8, 49015, '{"id":"eph-p15","sequence":15,"verseRange":"5:7-14","startChapter":5,"startVerse":7,"endChapter":5,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 5:15-21', 'eph-p16', 7, 49016, '{"id":"eph-p16","sequence":16,"verseRange":"5:15-21","startChapter":5,"startVerse":15,"endChapter":5,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 5:22-33', 'eph-p17', 12, 49017, '{"id":"eph-p17","sequence":17,"verseRange":"5:22-33","startChapter":5,"startVerse":22,"endChapter":5,"endVerse":33}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 6:1-9', 'eph-p18', 9, 49018, '{"id":"eph-p18","sequence":18,"verseRange":"6:1-9","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 6:10-20', 'eph-p19', 11, 49019, '{"id":"eph-p19","sequence":19,"verseRange":"6:10-20","startChapter":6,"startVerse":10,"endChapter":6,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Ephesians 6:21-24', 'eph-p20', 4, 49020, '{"id":"eph-p20","sequence":20,"verseRange":"6:21-24","startChapter":6,"startVerse":21,"endChapter":6,"endVerse":24}'::jsonb);

-- Philippians
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Philippians', 'php', 0, 50000, NULL
);

-- Colossians
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Colossians', 'col', 0, 51000, NULL
);

-- 1 Thessalonians
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '1 Thessalonians', '1th', 12, 52000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 1:1-10', '1th-p1', 10, 52001, '{"id":"1th-p1","sequence":1,"verseRange":"1:1-10","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 2:1-8', '1th-p2', 8, 52002, '{"id":"1th-p2","sequence":2,"verseRange":"2:1-8","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 2:9-13', '1th-p3a', 5, 52003, '{"id":"1th-p3a","sequence":3,"verseRange":"2:9-13","startChapter":2,"startVerse":9,"endChapter":2,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 2:14-16', '1th-p3b', 3, 52003, '{"id":"1th-p3b","sequence":3,"verseRange":"2:14-16","startChapter":2,"startVerse":14,"endChapter":2,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 2:17-3:5', '1th-p4', 9, 52004, '{"id":"1th-p4","sequence":4,"verseRange":"2:17-3:5","startChapter":2,"startVerse":17,"endChapter":3,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 3:6-13', '1th-p5', 8, 52005, '{"id":"1th-p5","sequence":5,"verseRange":"3:6-13","startChapter":3,"startVerse":6,"endChapter":3,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 4:1-8', '1th-p6', 8, 52006, '{"id":"1th-p6","sequence":6,"verseRange":"4:1-8","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 4:9-12', '1th-p7', 4, 52007, '{"id":"1th-p7","sequence":7,"verseRange":"4:9-12","startChapter":4,"startVerse":9,"endChapter":4,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 4:13-18', '1th-p8', 6, 52008, '{"id":"1th-p8","sequence":8,"verseRange":"4:13-18","startChapter":4,"startVerse":13,"endChapter":4,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 5:1-11', '1th-p9', 11, 52009, '{"id":"1th-p9","sequence":9,"verseRange":"5:1-11","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 5:12-22', '1th-p10', 11, 52010, '{"id":"1th-p10","sequence":10,"verseRange":"5:12-22","startChapter":5,"startVerse":12,"endChapter":5,"endVerse":22}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Thessalonians 5:23-28', '1th-p11', 6, 52011, '{"id":"1th-p11","sequence":11,"verseRange":"5:23-28","startChapter":5,"startVerse":23,"endChapter":5,"endVerse":28}'::jsonb);

-- 2 Thessalonians
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '2 Thessalonians', '2th', 6, 53000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Thessalonians 1:1-4', '2th-p1', 4, 53001, '{"id":"2th-p1","sequence":1,"verseRange":"1:1-4","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Thessalonians 1:5-12', '2th-p2', 8, 53002, '{"id":"2th-p2","sequence":2,"verseRange":"1:5-12","startChapter":1,"startVerse":5,"endChapter":1,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Thessalonians 2:1-12', '2th-p3', 12, 53003, '{"id":"2th-p3","sequence":3,"verseRange":"2:1-12","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Thessalonians 2:13-17', '2th-p4', 5, 53004, '{"id":"2th-p4","sequence":4,"verseRange":"2:13-17","startChapter":2,"startVerse":13,"endChapter":2,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Thessalonians 3:1-5', '2th-p5', 5, 53005, '{"id":"2th-p5","sequence":5,"verseRange":"3:1-5","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Thessalonians 3:6-18', '2th-p6', 13, 53006, '{"id":"2th-p6","sequence":6,"verseRange":"3:6-18","startChapter":3,"startVerse":6,"endChapter":3,"endVerse":18}'::jsonb);

-- 1 Timothy
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '1 Timothy', '1ti', 19, 54000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 1:1-2', '1ti-p1a', 2, 54001, '{"id":"1ti-p1a","sequence":1,"verseRange":"1:1-2","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":2}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 1:3-7', '1ti-p1b', 5, 54001, '{"id":"1ti-p1b","sequence":1,"verseRange":"1:3-7","startChapter":1,"startVerse":3,"endChapter":1,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 1:8-11', '1ti-p2', 4, 54002, '{"id":"1ti-p2","sequence":2,"verseRange":"1:8-11","startChapter":1,"startVerse":8,"endChapter":1,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 1:12-20', '1ti-p3', 9, 54003, '{"id":"1ti-p3","sequence":3,"verseRange":"1:12-20","startChapter":1,"startVerse":12,"endChapter":1,"endVerse":20}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 2:1-7', '1ti-p4', 7, 54004, '{"id":"1ti-p4","sequence":4,"verseRange":"2:1-7","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 2:8-15', '1ti-p5', 8, 54005, '{"id":"1ti-p5","sequence":5,"verseRange":"2:8-15","startChapter":2,"startVerse":8,"endChapter":2,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 3:1-7', '1ti-p6', 7, 54006, '{"id":"1ti-p6","sequence":6,"verseRange":"3:1-7","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 3:8-13', '1ti-p7', 6, 54007, '{"id":"1ti-p7","sequence":7,"verseRange":"3:8-13","startChapter":3,"startVerse":8,"endChapter":3,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 3:14-16', '1ti-p8', 3, 54008, '{"id":"1ti-p8","sequence":8,"verseRange":"3:14-16","startChapter":3,"startVerse":14,"endChapter":3,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 4:1-5', '1ti-p9', 5, 54009, '{"id":"1ti-p9","sequence":9,"verseRange":"4:1-5","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 4:6-10', '1ti-p10', 5, 54010, '{"id":"1ti-p10","sequence":10,"verseRange":"4:6-10","startChapter":4,"startVerse":6,"endChapter":4,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 4:11-16', '1ti-p11', 6, 54011, '{"id":"1ti-p11","sequence":11,"verseRange":"4:11-16","startChapter":4,"startVerse":11,"endChapter":4,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 5:1-8', '1ti-p12', 8, 54012, '{"id":"1ti-p12","sequence":12,"verseRange":"5:1-8","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 5:9-16', '1ti-p13', 8, 54013, '{"id":"1ti-p13","sequence":13,"verseRange":"5:9-16","startChapter":5,"startVerse":9,"endChapter":5,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 5:17-25', '1ti-p14', 9, 54014, '{"id":"1ti-p14","sequence":14,"verseRange":"5:17-25","startChapter":5,"startVerse":17,"endChapter":5,"endVerse":25}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 6:1-2e', '1ti-p15', 2, 54015, '{"id":"1ti-p15","sequence":15,"verseRange":"6:1-2e","startChapter":6,"startVerse":1,"endChapter":6,"endVerse":2}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 6:2f-10', '1ti-p16', 9, 54016, '{"id":"1ti-p16","sequence":16,"verseRange":"6:2f-10","startChapter":6,"startVerse":2,"endChapter":6,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 6:11-16', '1ti-p17', 6, 54017, '{"id":"1ti-p17","sequence":17,"verseRange":"6:11-16","startChapter":6,"startVerse":11,"endChapter":6,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 Timothy 6:17-21', '1ti-p18', 5, 54018, '{"id":"1ti-p18","sequence":18,"verseRange":"6:17-21","startChapter":6,"startVerse":17,"endChapter":6,"endVerse":21}'::jsonb);

-- 2 Timothy
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '2 Timothy', '2ti', 11, 55000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Timothy 1:1-7', '2ti-p1', 7, 55001, '{"id":"2ti-p1","sequence":1,"verseRange":"1:1-7","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Timothy 1:8-14', '2ti-p2', 7, 55002, '{"id":"2ti-p2","sequence":2,"verseRange":"1:8-14","startChapter":1,"startVerse":8,"endChapter":1,"endVerse":14}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Timothy 1:15-18', '2ti-p3', 4, 55003, '{"id":"2ti-p3","sequence":3,"verseRange":"1:15-18","startChapter":1,"startVerse":15,"endChapter":1,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Timothy 2:1-7', '2ti-p4', 7, 55004, '{"id":"2ti-p4","sequence":4,"verseRange":"2:1-7","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Timothy 2:8-13', '2ti-p5', 6, 55005, '{"id":"2ti-p5","sequence":5,"verseRange":"2:8-13","startChapter":2,"startVerse":8,"endChapter":2,"endVerse":13}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Timothy 2:14-19', '2ti-p6', 6, 55006, '{"id":"2ti-p6","sequence":6,"verseRange":"2:14-19","startChapter":2,"startVerse":14,"endChapter":2,"endVerse":19}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Timothy 2:20-26', '2ti-p7', 7, 55007, '{"id":"2ti-p7","sequence":7,"verseRange":"2:20-26","startChapter":2,"startVerse":20,"endChapter":2,"endVerse":26}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Timothy 3:1-9', '2ti-p8', 9, 55008, '{"id":"2ti-p8","sequence":8,"verseRange":"3:1-9","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Timothy 3:10-17', '2ti-p9', 8, 55009, '{"id":"2ti-p9","sequence":9,"verseRange":"3:10-17","startChapter":3,"startVerse":10,"endChapter":3,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Timothy 4:1-8', '2ti-p10', 8, 55010, '{"id":"2ti-p10","sequence":10,"verseRange":"4:1-8","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 Timothy 4:9-22', '2ti-p11', 14, 55011, '{"id":"2ti-p11","sequence":11,"verseRange":"4:9-22","startChapter":4,"startVerse":9,"endChapter":4,"endVerse":22}'::jsonb);

-- Titus
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Titus', 'tit', 7, 56000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Titus 1:1-4', 'tit-p1', 4, 56001, '{"id":"tit-p1","sequence":1,"verseRange":"1:1-4","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Titus 1:5-9', 'tit-p2', 5, 56002, '{"id":"tit-p2","sequence":2,"verseRange":"1:5-9","startChapter":1,"startVerse":5,"endChapter":1,"endVerse":9}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Titus 1:10-16', 'tit-p3', 7, 56003, '{"id":"tit-p3","sequence":3,"verseRange":"1:10-16","startChapter":1,"startVerse":10,"endChapter":1,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Titus 2:1-10', 'tit-p4', 10, 56004, '{"id":"tit-p4","sequence":4,"verseRange":"2:1-10","startChapter":2,"startVerse":1,"endChapter":2,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Titus 2:11-15', 'tit-p5', 5, 56005, '{"id":"tit-p5","sequence":5,"verseRange":"2:11-15","startChapter":2,"startVerse":11,"endChapter":2,"endVerse":15}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Titus 3:1-11', 'tit-p6', 11, 56006, '{"id":"tit-p6","sequence":6,"verseRange":"3:1-11","startChapter":3,"startVerse":1,"endChapter":3,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Titus 3:12-15', 'tit-p7', 4, 56007, '{"id":"tit-p7","sequence":7,"verseRange":"3:12-15","startChapter":3,"startVerse":12,"endChapter":3,"endVerse":15}'::jsonb);

-- Philemon
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Philemon', 'phm', 0, 57000, NULL
);

-- Hebrews
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Hebrews', 'heb', 0, 58000, NULL
);

-- James
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'James', 'jas', 0, 59000, NULL
);

-- 1 Peter
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', '1 Peter', '1pe', 0, 60000, NULL
);

-- 2 Peter
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', '2 Peter', '2pe', 0, 61000, NULL
);

-- 1 John
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '1 John', '1jn', 14, 62000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 1:1-4', '1jn-p1', 4, 62001, '{"id":"1jn-p1","sequence":1,"verseRange":"1:1-4","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":4}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 1:5-2:2', '1jn-p2', 8, 62002, '{"id":"1jn-p2","sequence":2,"verseRange":"1:5-2:2","startChapter":1,"startVerse":5,"endChapter":2,"endVerse":2}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 2:3-11', '1jn-p3', 9, 62003, '{"id":"1jn-p3","sequence":3,"verseRange":"2:3-11","startChapter":2,"startVerse":3,"endChapter":2,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 2:12-17', '1jn-p4', 6, 62004, '{"id":"1jn-p4","sequence":4,"verseRange":"2:12-17","startChapter":2,"startVerse":12,"endChapter":2,"endVerse":17}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 2:18-28', '1jn-p5', 11, 62005, '{"id":"1jn-p5","sequence":5,"verseRange":"2:18-28","startChapter":2,"startVerse":18,"endChapter":2,"endVerse":28}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 2:29-3:10', '1jn-p6', 11, 62006, '{"id":"1jn-p6","sequence":6,"verseRange":"2:29-3:10","startChapter":2,"startVerse":29,"endChapter":3,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 3:11-18', '1jn-p7', 8, 62007, '{"id":"1jn-p7","sequence":7,"verseRange":"3:11-18","startChapter":3,"startVerse":11,"endChapter":3,"endVerse":18}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 3:19-24', '1jn-p8', 6, 62008, '{"id":"1jn-p8","sequence":8,"verseRange":"3:19-24","startChapter":3,"startVerse":19,"endChapter":3,"endVerse":24}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 4:1-6', '1jn-p9', 6, 62009, '{"id":"1jn-p9","sequence":9,"verseRange":"4:1-6","startChapter":4,"startVerse":1,"endChapter":4,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 4:7-12', '1jn-p10', 6, 62010, '{"id":"1jn-p10","sequence":10,"verseRange":"4:7-12","startChapter":4,"startVerse":7,"endChapter":4,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 4:13-21', '1jn-p11', 9, 62011, '{"id":"1jn-p11","sequence":11,"verseRange":"4:13-21","startChapter":4,"startVerse":13,"endChapter":4,"endVerse":21}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 5:1-5', '1jn-p12', 5, 62012, '{"id":"1jn-p12","sequence":12,"verseRange":"5:1-5","startChapter":5,"startVerse":1,"endChapter":5,"endVerse":5}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 5:6-12', '1jn-p13', 7, 62013, '{"id":"1jn-p13","sequence":13,"verseRange":"5:6-12","startChapter":5,"startVerse":6,"endChapter":5,"endVerse":12}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '1 John 5:13-21', '1jn-p14', 9, 62014, '{"id":"1jn-p14","sequence":14,"verseRange":"5:13-21","startChapter":5,"startVerse":13,"endChapter":5,"endVerse":21}'::jsonb);

-- 2 John
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '2 John', '2jn', 3, 63000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 John 1:1-3', '2jn-p1', 3, 63001, '{"id":"2jn-p1","sequence":1,"verseRange":"1:1-3","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":3}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 John 1:4-6', '2jn-p2', 3, 63002, '{"id":"2jn-p2","sequence":2,"verseRange":"1:4-6","startChapter":1,"startVerse":4,"endChapter":1,"endVerse":6}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '2 John 1:7-13', '2jn-p3', 7, 63003, '{"id":"2jn-p3","sequence":3,"verseRange":"1:7-13","startChapter":1,"startVerse":7,"endChapter":1,"endVerse":13}'::jsonb);

-- 3 John
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', '3 John', '3jn', 3, 64000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '3 John 1:1-8', '3jn-p1', 8, 64001, '{"id":"3jn-p1","sequence":1,"verseRange":"1:1-8","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":8}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '3 John 1:9-10', '3jn-p2', 2, 64002, '{"id":"3jn-p2","sequence":2,"verseRange":"1:9-10","startChapter":1,"startVerse":9,"endChapter":1,"endVerse":10}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', '3 John 1:11-15', '3jn-p3', 5, 64003, '{"id":"3jn-p3","sequence":3,"verseRange":"1:11-15","startChapter":1,"startVerse":11,"endChapter":1,"endVerse":15}'::jsonb);

-- Jude
WITH inserted_book AS (
  INSERT INTO public.template_structure (
    parent_id, template, language, type, title, item_id, item_count, order_index, metadata
  )
  VALUES (
    NULL, 'fia', 'any', 'book', 'Jude', 'jud', 6, 65000, NULL
  )
  RETURNING id
)
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Jude 1:1-2', 'jud-p1', 2, 65001, '{"id":"jud-p1","sequence":1,"verseRange":"1:1-2","startChapter":1,"startVerse":1,"endChapter":1,"endVerse":2}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Jude 1:3-7', 'jud-p2', 5, 65002, '{"id":"jud-p2","sequence":2,"verseRange":"1:3-7","startChapter":1,"startVerse":3,"endChapter":1,"endVerse":7}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Jude 1:8-11', 'jud-p3', 4, 65003, '{"id":"jud-p3","sequence":3,"verseRange":"1:8-11","startChapter":1,"startVerse":8,"endChapter":1,"endVerse":11}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Jude 1:12-16', 'jud-p4', 5, 65004, '{"id":"jud-p4","sequence":4,"verseRange":"1:12-16","startChapter":1,"startVerse":12,"endChapter":1,"endVerse":16}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Jude 1:17-23', 'jud-p5', 7, 65005, '{"id":"jud-p5","sequence":5,"verseRange":"1:17-23","startChapter":1,"startVerse":17,"endChapter":1,"endVerse":23}'::jsonb),
  ((SELECT id FROM inserted_book), 'fia', 'any', 'pericope', 'Jude 1:24-25', 'jud-p6', 2, 65006, '{"id":"jud-p6","sequence":6,"verseRange":"1:24-25","startChapter":1,"startVerse":24,"endChapter":1,"endVerse":25}'::jsonb);

-- Revelation
INSERT INTO public.template_structure (
  parent_id, template, language, type, title, item_id, item_count, order_index, metadata
)
VALUES (
  NULL, 'fia', 'any', 'book', 'Revelation', 'rev', 0, 66000, NULL
);

  end if;
end $$;