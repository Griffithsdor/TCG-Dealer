-- Seed inicial: los dos juegos del arranque.
INSERT INTO games (code, name) VALUES
    ('one_piece', 'One Piece Card Game'),
    ('pokemon',   'Pokémon Trading Card Game')
ON CONFLICT (code) DO NOTHING;
