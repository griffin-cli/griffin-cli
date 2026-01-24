import { expect } from 'chai';
import normalizeEnvVarName from '../../src/utils/normalize-env-var-name.js';

describe('normalizeEnvVarName()', () => {
  it('should return a properly formatted name', () => {
    const name = 'MY_VAR';

    expect(normalizeEnvVarName(name)).to.equal(name);
  });

  it('should convert the name to uppercase', () => {
    const input = 'my_var';
    const expected = 'MY_VAR';

    expect(normalizeEnvVarName(input)).to.equal(expected);
  });

  it('should replace special characters with underscores', () => {
    const input = 'a b-c~d!e@f#g$h%i^j&k*l(m)n<o+p=q[r{s]t}u\\v|w:x;y<z';
    const expected = 'A_B_C_D_E_F_G_H_I_J_K_L_M_N_O_P_Q_R_S_T_U_V_W_X_Y_Z';

    expect(normalizeEnvVarName(input)).to.equal(expected);
  });

  it('should allow numbers', () => {
    const name = 'MY_VAR1';

    expect(normalizeEnvVarName(name)).to.equal(name);
  });
});
